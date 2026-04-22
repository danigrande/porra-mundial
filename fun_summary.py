import json
import requests
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import sys

# 1. Configuration
SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwUG7NAswIhcLn90C6JkA_Dt-45HBz8Klvmwij2UO0ilh85KUs6tUTz05-wALfTulnN/exec'
LM_STUDIO_URL = "http://localhost:1234/v1"

# Initialize LangChain LLM (pointing to LM Studio)
llm = ChatOpenAI(
    base_url=LM_STUDIO_URL,
    api_key="lm-studio",
    temperature=0.8
)

def fetch_leaderboard_data():
    try:
        response = requests.get(SCRIPT_URL)
        data = response.json()
        return data.get('data', {})
    except Exception as e:
        print(f"Error fetching data: {e}")
        return {}

def load_user_profiles():
    try:
        with open('user_profiles.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def generate_fun_summary(player_name):
    # Fetch all data
    all_players_data = fetch_leaderboard_data()
    profiles = load_user_profiles()
    
    if player_name not in all_players_data:
        return f"No encontré datos para el jugador {player_name}."
    
    player_stats = all_players_data[player_name]
    profile = profiles.get(player_name, {
        "nickname": player_name,
        "likes": ["Fútbol"],
        "dislikes": ["Perder"],
        "humor_style": "Normal"
    })
    
    # Simple ranking logic (this is a mock since we don't have the full scoring here, 
    # but we can pass the raw data to the LLM and let it interpret it)
    
    # Create the Prompt
    template = ChatPromptTemplate.from_messages([
        ("system", """Eres un comentarista deportivo como Andres Montes, excentrico, divertido y muy carismático. 
        Tu objetivo es resumir el estado de la 'Porra Mundial 2026' para un jugador específico.
        Usa un tono {humor_style}. Refiérete al jugador por su nickname: {nickname}.
        Ten en cuenta lo que le gusta ({likes}) y lo que no le gusta ({dislikes}). Puedes decir groserias.
        """),
        ("human", """Aquí tienes los datos actuales de la porra:
        Datos de {player_name}: {player_stats}
        
        Otros jugadores destacados: {other_players}
        
        Por favor, haz un resumen corto (máximo 3 frases) que sea divertido, 
        analice su posición y le de un consejo 'experto' basado en sus gustos.
        """)
    ])
    
    # Prepare data for the prompt
    other_players_brief = ", ".join(list(all_players_data.keys())[:5]) # Top 5 names
    
    chain = template | llm
    
    response = chain.invoke({
        "humor_style": profile["humor_style"],
        "nickname": profile["nickname"],
        "likes": ", ".join(profile["likes"]),
        "dislikes": ", ".join(profile["dislikes"]),
        "player_name": player_name,
        "player_stats": json.dumps(player_stats),
        "other_players": other_players_brief
    })
    
    return response.content

if __name__ == "__main__":
    if len(sys.argv) > 1:
        name = sys.argv[1]
    else:
        name = "Dani"
        
    print(f"--- Generando resumen para {name} ---")
    summary = generate_fun_summary(name)
    print("\n" + summary)
