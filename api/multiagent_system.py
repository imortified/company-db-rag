import operator
from typing import TypedDict, List, Optional, Annotated, Literal
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from chroma_utils import vectorstore
from langchain_utils import get_rag_chain
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    question: str                           # исходный вопрос
    chat_history: List[BaseMessage]         # история диалога
    plan: List[str]                         # список подвопросов
    current_step: int                       # текущий шаг выполнения плана
    context_data: Annotated[List[str], operator.add]  # собранные фрагменты из RAG
    generation: str                         # итоговый ответ
    critique: Optional[str]                 # замечания критика
    iterations: int                         # количество итераций улучшения
    max_iterations: int                     # максимальное количество итераций

llm = ChatOllama(model="llama3.2", temperature=0)

# Агент маршутизатор
router_prompt = ChatPromptTemplate.from_messages([
    ("system", "Ты — маршрутизатор. Определи, требует ли вопрос пользователя сложного анализа (несколько источников, сравнение, планирование) или это простой фактологический вопрос. Отвечай только 'simple' или 'complex'."),
    ("human", "{question}")
])
router_chain = router_prompt | llm

def route_question(state: AgentState) -> Literal["simple", "complex"]:
    response = router_chain.invoke({"question": state["question"]})
    decision = response.content.strip().lower()
    logger.info(f"Router decision: {decision}")
    if "complex" in decision:
        return "complex"
    return "simple"

# Планировщик для сложных вопросов
planner_prompt = ChatPromptTemplate.from_messages([
    ("system", "Ты — агент-планировщик. Разбей следующий вопрос на 2-4 простых подвопроса, которые помогут на него ответить. Каждый подвопрос должен быть самодостаточным. Отвечай в виде нумерованного списка, каждый пункт начинается с новой строки."),
    ("human", "{question}")
])
planner_chain = planner_prompt | llm

def generate_plan(state: AgentState) -> AgentState:
    response = planner_chain.invoke({"question": state["question"]})
    lines = response.content.strip().split("\n")
    plan = []
    for line in lines:
        line = line.strip()
        if line and (line[0].isdigit() or line.startswith("-")):
            clean = line.lstrip("0123456789.-• ").strip()
            if clean:
                plan.append(clean)
    if not plan:
        plan = [state["question"]]
    logger.info(f"Generated plan: {plan}")
    return {**state, "plan": plan, "current_step": 0, "context_data": []}

def execute_plan_step(state: AgentState) -> AgentState:
    current = state["current_step"]
    plan = state["plan"]
    if current >= len(plan):
        return state
    
    sub_question = plan[current]
    logger.info(f"Executing step {current+1}/{len(plan)}: {sub_question}")
    
    rag_chain = get_rag_chain()
    result = rag_chain.invoke({
        "input": sub_question,
        "chat_history": []
    })
    answer = result["answer"]
    context_entry = f"Вопрос: {sub_question}\nОтвет: {answer}"
    new_context = state.get("context_data", []) + [context_entry]
    
    return {
        **state,
        "current_step": current + 1,
        "context_data": new_context
    }

def should_continue_plan(state: AgentState) -> Literal["execute", "generate_final"]:
    if state["current_step"] < len(state["plan"]):
        return "execute"
    return "generate_final"

generator_prompt = ChatPromptTemplate.from_messages([
    ("system", "Ты — помощник. Используя собранный контекст, ответь на исходный вопрос пользователя. Не выдумывай факты, которых нет в контексте. Если информации недостаточно, скажи об этом.\n\nКонтекст:\n{context}"),
    ("human", "{question}")
])
generator_chain = generator_prompt | llm

def generate_final_answer(state: AgentState) -> AgentState:
    context = "\n\n".join(state.get("context_data", []))
    response = generator_chain.invoke({
        "context": context if context else "Нет релевантной информации.",
        "question": state["question"]
    })
    return {**state, "generation": response.content}
# Агент критик
critic_prompt = ChatPromptTemplate.from_messages([
    ("system", "Ты — критик. Оцени ответ на вопрос по критериям: полнота, релевантность, использование предоставленного контекста, отсутствие галлюцинаций. Если ответ идеальный, напиши 'APPROVE'. Если нужны улучшения, опиши чётко, какой информации не хватает и что исправить. Будь конструктивен."),
    ("human", "Вопрос: {question}\nКонтекст:\n{context}\nОтвет:\n{generation}\nОценка и замечания:")
])
critic_chain = critic_prompt | llm

def critique_answer(state: AgentState) -> AgentState:
    context = "\n\n".join(state.get("context_data", []))
    response = critic_chain.invoke({
        "question": state["question"],
        "context": context if context else "Нет контекста",
        "generation": state["generation"]
    })
    critique_text = response.content
    logger.info(f"Critic: {critique_text[:200]}")
    return {**state, "critique": critique_text}

def should_improve(state: AgentState) -> Literal["improve", "finish"]:
    if "APPROVE" in state["critique"].upper():
        return "finish"
    if state["iterations"] >= state["max_iterations"]:
        logger.warning("Max iterations reached, finishing.")
        return "finish"
    return "improve"

improve_prompt = ChatPromptTemplate.from_messages([
    ("system", "Ты — помощник. Улучши свой предыдущий ответ, учитывая замечания критика. Используй тот же контекст, но исправь ошибки и добавь недостающую информацию.\nКонтекст:\n{context}\n\nЗамечания критика:\n{critique}\n\nТвой улучшенный ответ:"),
    ("human", "{question}")
])
improve_chain = improve_prompt | llm

def improve_answer(state: AgentState) -> AgentState:
    context = "\n\n".join(state.get("context_data", []))
    new_generation = improve_chain.invoke({
        "context": context if context else "Нет контекста",
        "critique": state["critique"],
        "question": state["question"]
    }).content
    return {
        **state,
        "generation": new_generation,
        "iterations": state["iterations"] + 1
    }

complex_graph = StateGraph(AgentState)

complex_graph.add_node("plan", generate_plan)
complex_graph.add_node("execute", execute_plan_step)
complex_graph.add_node("generate", generate_final_answer)
complex_graph.add_node("critique", critique_answer)
complex_graph.add_node("improve", improve_answer)

complex_graph.set_entry_point("plan")
complex_graph.add_edge("plan", "execute")
complex_graph.add_conditional_edges("execute", should_continue_plan, {
    "execute": "execute",
    "generate_final": "generate"
})
complex_graph.add_edge("generate", "critique")
complex_graph.add_conditional_edges("critique", should_improve, {
    "improve": "improve",
    "finish": END
})
complex_graph.add_edge("improve", "critique")

complex_app = complex_graph.compile()

def simple_answer(state: AgentState) -> AgentState: # Для простого вопроса
    rag_chain = get_rag_chain()
    result = rag_chain.invoke({
        "input": state["question"],
        "chat_history": state.get("chat_history", [])
    })
    return {**state, "generation": result["answer"]}

def rag_agent(state: AgentState) -> dict:
    decision = route_question(state)
    if decision == "simple":
        logger.info("Using simple answer (direct RAG).")
        return simple_answer(state)
    else:
        logger.info("Using complex agent (planner + critic).")
        init_state = {
            **state,
            "plan": [],
            "current_step": 0,
            "context_data": [],
            "generation": "",
            "critique": None,
            "iterations": 0,
            "max_iterations": 2
        }
        final_state = complex_app.invoke(init_state)
        return final_state