import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.1.0";

// 1. Configuração do seu Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDH0szcDymOoxVCue8rMTdiv78pTNOPa6s",
    authDomain: "analises-jb.firebaseapp.com",
    projectId: "analises-jb",
    storageBucket: "analises-jb.firebasestorage.app",
    messagingSenderId: "295441850978",
    appId: "1:295441850978:web:6b206edf7d6fe8881d273b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Configuração da IA (Gemini) para leitura do site
const genAI = new GoogleGenerativeAI("AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- FUNÇÃO: SINCRONIZAR COM O SITE (VIA IA) ---
async function sincronizarHoje() {
    const status = document.getElementById('status');
    status.innerText = "⏳ IA lendo resultados no site...";
    
    // Prompt específico para a IA extrair os dados do link que você passou
    const prompt = `Acesse o site https://www.resultadofacil.com.br/resultados-pt-rio-de-hoje e extraia os resultados do 1º prêmio de hoje para os horários: 9hs (PTM), 11hs (PT), 14hs (PTV), 16hs (PTN), 18hs (Fed/Coruja), 21hs. 
    Retorne APENAS um objeto JSON puro no formato: {"dd/mm/aaaa": {"9hs": "valor", "11hs": "valor", "14hs": "valor", "16hs": "valor", "18hs": "valor", "21hs": "valor"}}. 
    Se não houver resultado ainda, use "---".`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textoJson = response.text();

        // Limpeza básica do retorno da IA
        textoJson = textoJson.replace(/```json|```/g, "").trim();
        const dadosExtraidos = JSON.parse(textoJson);

        // Salva cada data encontrada no Firebase
        for (const dataKey in dadosExtraidos) {
            await setDoc(doc(db, "resultados_jb", dataKey), {
                ...dadosExtraidos[dataKey],
                atualizadoEm: new Date().toISOString()
            });
            console.log("Sucesso ao salvar:", dataKey);
        }

        status.innerText = "✅ Sincronizado com o site!";
        alert("Dados de hoje atualizados com sucesso!");

    } catch (error) {
        console.error("Erro na sincronização:", error);
        status.innerText = "❌ Erro ao conectar com a IA/Site.";
    }
}

// --- FUNÇÃO: BUSCAR NO BANCO DE DADOS (FILTRO) ---
async function filtrarResultados() {
    let dataInput = document.getElementById('filtroData').value; 
    const grid = document.getElementById('gridResultados');
    
    if (!dataInput) return alert("Escolha uma data!");

    // Converte AAAA-MM-DD para DD/MM/AAAA para bater com o ID do Firebase
    if (dataInput.includes("-")) {
        const [ano, mes, dia] = dataInput.split("-");
        dataInput = `${dia}/${mes}/${ano}`;
    }

    grid.innerHTML = "Buscando...";

    try {
        const docSnap = await getDoc(doc(db, "resultados_jb", dataInput));
        
        if (docSnap.exists()) {
            const d = docSnap.data();
            const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
            
            grid.innerHTML = horas.map(h => `
                <div class="bg-white p-4 rounded-xl border-2 border-blue-500 shadow-lg text-center">
                    <span class="text-xs font-bold text-blue-600 uppercase">${h}</span>
                    <p class="text-3xl font-black text-slate-800">${d[h] || '---'}</p>
                </div>
            `).join('');
        } else {
            grid.innerHTML = `<div class="col-span-full p-4 bg-yellow-100 text-yellow-800 rounded-lg text-center">
                Sem dados para ${dataInput}. Clique em "Sincronizar Hoje" primeiro.
            </div>`;
        }
    } catch (e) {
        console.error(e);
        grid.innerHTML = "Erro ao carregar dados.";
    }
}

// --- EVENT LISTENER (LIGA OS BOTÕES DO HTML AO JAVASCRIPT) ---
document.addEventListener('DOMContentLoaded', () => {
    // Botão de Sincronizar (IA)
    const btnSync = document.getElementById('btnSync');
    if(btnSync) btnSync.addEventListener('click', sincronizarHoje);

    // Botão de Filtrar (Calendário)
    const btnFiltrar = document.getElementById('btnFiltrar');
    if(btnFiltrar) btnFiltrar.addEventListener('click', filtrarResultados);
});