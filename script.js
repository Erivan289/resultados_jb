import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Importando a biblioteca da IA do Google via CDN
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

 // Em vez de colar a chave aqui, usaremos uma variável de ambiente
// Linha 8 corrigida para não travar o botão "Processar"
const API_KEY_IA = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_KEY) 
    || "AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU";

// Configuração da IA (Google Gemini)
const genAI = new GoogleGenerativeAI(API_KEY_IA);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Função para pedir análise da IA sobre os resultados
async function analisarComIA(dadosDosResultados) {
    try {
        const prompt = `Analise estes resultados do jogo de 01/09/2024: ${JSON.stringify(dadosDosResultados)}. Quais são as tendências para os próximos sorteios?`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Análise da IA:", response.text());
        
        // Se você tiver um campo de texto no HTML para exibir a análise:
        // document.getElementById('campo-analise').innerText = response.text();
        
    } catch (error) {
        console.error("Erro na análise da IA:", error);
    }
}

const genAI = new GoogleGenerativeAI(API_KEY_IA);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Função para pedir análise da IA sobre os resultados
async function analisarComIA(dadosDosResultados) {
    const prompt = `Analise estes resultados do jogo do bicho: ${JSON.stringify(dadosDosResultados)}. 
                    Quais são as tendências para o próximo sorteio?`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("Análise da IA:", response.text());
}

// COLE SUAS CONFIGURAÇÕES DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "seu-id",
    appId: "seu-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referências do DOM
const inputExcel = document.getElementById('inputExcel');
const btnImportar = document.getElementById('btnImportar');
const status = document.getElementById('status');
const gridResultados = document.getElementById('gridResultados');
const filtroData = document.getElementById('filtroData');
const btnFiltrar = document.getElementById('btnFiltrar');

// 1. FUNÇÃO PARA LER EXCEL E SALVAR NO FIREBASE
btnImportar.addEventListener('click', () => {
    const file = inputExcel.files[0];
    if (!file) {
        alert("Por favor, selecione um arquivo primeiro!");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converte para JSON (Assume que a primeira linha são os horários)
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        status.innerText = "⏳ Processando dados...";
        
        try {
            for (const row of jsonData) {
                // Supondo que sua planilha tenha uma coluna 'data' ou você queira usar uma data base
                // Aqui vamos usar a data da linha ou gerar uma baseada na ordem
                const dataDoc = row.data || filtroData.value; 

                await setDoc(doc(db, "resultados_jb", dataDoc), {
                    "9hs": row["9hs"] || row["9h"] || "",
                    "11hs": row["11hs"] || row["11h"] || "",
                    "14hs": row["14hs"] || row["14h"] || "",
                    "16hs": row["16hs"] || row["16h"] || "",
                    "18hs": row["18hs"] || row["18h"] || "",
                    "21hs": row["21hs"] || row["21h"] || "",
                    atualizadoEm: new Date().toISOString()
                });
            }
            status.className = "mt-4 text-sm font-medium text-green-600";
            status.innerText = "✅ Dados importados com sucesso!";
        } catch (error) {
            console.error(error);
            status.className = "mt-4 text-sm font-medium text-red-600";
            status.innerText = "❌ Erro ao salvar no Firebase.";
        }
    };
    reader.readAsArrayBuffer(file);
});

// 2. FUNÇÃO PARA BUSCAR E EXIBIR RESULTADOS
async function buscarResultados() {
    const dataAlvo = filtroData.value;
    gridResultados.innerHTML = "<p class='text-slate-400'>Buscando...</p>";

    try {
        const docRef = doc(db, "resultados_jb", dataAlvo);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const dados = docSnap.data();
            const horários = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
            
            gridResultados.innerHTML = horários.map(h => `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span class="text-xs font-bold text-blue-600 uppercase">${h}</span>
                    <p class="text-xl font-black text-slate-800">${dados[h] || '---'}</p>
                </div>
            `).join('');
        } else {
            gridResultados.innerHTML = "<p class='col-span-full text-center text-slate-500'>Nenhum resultado para esta data.</p>";
        }
    } catch (error) {
        gridResultados.innerHTML = "<p class='text-red-500'>Erro ao carregar.</p>";
    }
}

btnFiltrar.addEventListener('click', buscarResultados);