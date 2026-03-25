import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// 1. CONFIGURAÇÃO DA IA (GEMINI)
const API_KEY_IA = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_KEY) 
    || "AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU";

const genAI = new GoogleGenerativeAI(API_KEY_IA);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Função Única para análise da IA
async function analisarComIA(dadosDosResultados) {
    try {
        const prompt = `Analise estes resultados do jogo do bicho de 01/09/2024: ${JSON.stringify(dadosDosResultados)}. 
                        Quais são as tendências para os próximos sorteios?`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Análise da IA:", response.text());
        
        const campoAnalise = document.getElementById('campo-analise');
        if (campoAnalise) campoAnalise.innerText = response.text();
        
    } catch (error) {
        console.error("Erro na análise da IA:", error);
    }
}

// 2. CONFIGURAÇÃO DO FIREBASE (COLE SUAS CHAVES REAIS AQUI)
const firebaseConfig = {
  apiKey: "AIzaSyDH0szcDymOoxVCue8rMTdiv78pTNOPa6s",
  authDomain: "analises-jb.firebaseapp.com",
  projectId: "analises-jb",
  storageBucket: "analises-jb.firebasestorage.app",
  messagingSenderId: "295441850978",
  appId: "1:295441850978:web:6b206edf7d6fe8881d273b",
  measurementId: "G-8QDMJ692N5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. REFERÊNCIAS DO DOM
const inputExcel = document.getElementById('inputExcel');
const btnImportar = document.getElementById('btnImportar');
const status = document.getElementById('status');
const gridResultados = document.getElementById('gridResultados');
const filtroData = document.getElementById('filtroData');
const btnFiltrar = document.getElementById('btnFiltrar');

// 4. FUNÇÃO PARA LER EXCEL E SALVAR
btnImportar.addEventListener('click', () => {
    const file = inputExcel.files[0];
    if (!file) {
        alert("Por favor, selecione um arquivo primeiro!");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            status.innerText = "⏳ Processando dados...";
            
            for (const row of jsonData) {
                // Tenta pegar a data da planilha ou do campo de data
                const dataDoc = row.data || row.Data || filtroData.value; 

                if (!dataDoc) continue;

                await setDoc(doc(db, "resultados_jb", dataDoc), {
                    "9hs": row["9hs"] || row["9h"] || row["__EMPTY_1"] || "",
                    "11hs": row["11hs"] || row["11h"] || row["__EMPTY_2"] || "",
                    "14hs": row["14hs"] || row["14h"] || row["__EMPTY_3"] || "",
                    "16hs": row["16hs"] || row["16h"] || row["__EMPTY_4"] || "",
                    "18hs": row["18hs"] || row["18h"] || row["__EMPTY_5"] || "",
                    "21hs": row["21hs"] || row["21h"] || row["__EMPTY_6"] || "",
                    atualizadoEm: new Date().toISOString()
                });
            }
            
            status.className = "mt-4 text-sm font-medium text-green-600";
            status.innerText = "✅ Dados importados com sucesso!";
            
            // Chama a IA após importar
            analisarComIA(jsonData);

        } catch (error) {
            console.error(error);
            status.className = "mt-4 text-sm font-medium text-red-600";
            status.innerText = "❌ Erro ao processar arquivo ou salvar no Firebase.";
        }
    };
    reader.readAsArrayBuffer(file);
});

// 5. FUNÇÃO PARA BUSCAR RESULTADOS
async function buscarResultados() {
    const dataAlvo = filtroData.value;
    if (!dataAlvo) {
        alert("Selecione uma data para filtrar!");
        return;
    }

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
        console.error(error);
        gridResultados.innerHTML = "<p class='text-red-500'>Erro ao carregar dados.</p>";
    }
}

btnFiltrar.addEventListener('click', buscarResultados);