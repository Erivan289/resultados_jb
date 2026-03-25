import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. IMPORTAÇÃO DA IA COM VERSÃO ESPECÍFICA (Para evitar o erro 404)
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.1.1";

// 2. CONFIGURAÇÃO DA IA (GEMINI)
const API_KEY_IA = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_KEY) 
    || "AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU";

const genAI = new GoogleGenerativeAI(API_KEY_IA);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
}, { apiVersion: 'v1beta' }); // <--- Isso força a versão correta do AI Studio

// Função de análise da IA com integração visual
async function analisarComIA(dadosDosResultados) {
    const campoAnalise = document.getElementById('campo-analise');
    const containerAnalise = document.getElementById('container-analise');

    try {
        console.log("Iniciando análise com a IA...");
        if (containerAnalise) containerAnalise.classList.remove('hidden');
        if (campoAnalise) campoAnalise.innerText = "Pensando nas tendências... 🎲";

        const prompt = `Analise estes resultados do jogo do bicho: ${JSON.stringify(dadosDosResultados)}. 
                        Com base nos milhares sorteados, quais são as tendências e bichos prováveis para os próximos sorteios? Responda de forma clara.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textoAnalise = response.text();
        
        console.log("✅ Análise da IA concluída");
        
        // Exibe no painel do HTML
        if (campoAnalise) {
            campoAnalise.innerHTML = textoAnalise.replace(/\n/g, '<br>');
        }
        
    } catch (error) {
        console.error("❌ Erro na análise da IA:", error);
        if (campoAnalise) campoAnalise.innerText = "Não foi possível gerar a análise agora. Verifique o console.";
    }
}

// 3. CONFIGURAÇÃO DO FIREBASE (Suas chaves reais do projeto analises-jb)
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

// 4. REFERÊNCIAS DO DOM
const inputExcel = document.getElementById('inputExcel');
const btnImportar = document.getElementById('btnImportar');
const status = document.getElementById('status');
const gridResultados = document.getElementById('gridResultados');
const filtroData = document.getElementById('filtroData');
const btnFiltrar = document.getElementById('btnFiltrar');

// 5. FUNÇÃO PARA LER EXCEL E SALVAR NO BANCO
btnImportar.addEventListener('click', () => {
    const file = inputExcel.files[0];
    if (!file) {
        alert("Por favor, selecione um arquivo Excel primeiro!");
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

            status.innerText = "⏳ Processando e salvando dados...";
            
            for (const row of jsonData) {
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
            
            // Dispara a IA
            analisarComIA(jsonData);

        } catch (error) {
            console.error("Erro no processamento:", error);
            status.className = "mt-4 text-sm font-medium text-red-600";
            status.innerText = "❌ Erro ao salvar no Firebase.";
        }
    };
    reader.readAsArrayBuffer(file);
});

// 6. FUNÇÃO PARA BUSCAR E EXIBIR OS RESULTADOS SALVOS
async function buscarResultados() {
    const dataAlvo = filtroData.value;
    if (!dataAlvo) {
        alert("Selecione uma data para buscar!");
        return;
    }

    gridResultados.innerHTML = "<p class='text-slate-400'>Buscando resultados...</p>";

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
            gridResultados.innerHTML = "<p class='col-span-full text-center text-slate-500'>Nenhum resultado encontrado para esta data.</p>";
        }
    } catch (error) {
        console.error(error);
        gridResultados.innerHTML = "<p class='text-red-500'>Erro ao carregar dados do banco.</p>";
    }
}

btnFiltrar.addEventListener('click', buscarResultados);