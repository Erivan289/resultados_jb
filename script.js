import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.1.0";

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
const genAI = new GoogleGenerativeAI("AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// FUNÇÃO PARA CONVERTER "2-set" EM "2024-09-02"
function formatarDataPlanilha(texto) {
    if (!texto || typeof texto !== 'string') return null;
    const partes = texto.toLowerCase().split('-');
    if (partes.length < 2) return null;

    const dia = partes[0].padStart(2, '0');
    const meses = { 'set': '09', 'out': '10', 'nov': '11', 'dez': '12' };
    const mes = meses[partes[1]] || '09';
    return `2024-${mes}-${dia}`;
}

document.getElementById('btnImportar').addEventListener('click', () => {
    const file = document.getElementById('inputExcel').files[0];
    if (!file) return alert("Selecione o arquivo!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Lendo como matriz (array de arrays) para navegar nas colunas
        const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const resultadosPorData = {};

        // 1. Identificar as datas nas colunas (Linha 0 da planilha)
        const cabecalho = matriz[0]; 
        
        // 2. Percorrer a matriz para extrair os dados
        // Vamos procurar os blocos de 9hs, 11hs, etc.
        let horarioAtual = "";

        matriz.forEach((linha) => {
            const primeiraCelula = String(linha[0] || "").toLowerCase();
            
            if (primeiraCelula.includes("9hs")) horarioAtual = "9hs";
            else if (primeiraCelula.includes("11hs")) horarioAtual = "11hs";
            else if (primeiraCelula.includes("14hs")) horarioAtual = "14hs";
            else if (primeiraCelula.includes("16hs")) horarioAtual = "16hs";
            else if (primeiraCelula.includes("18hs")) horarioAtual = "18hs";
            else if (primeiraCelula.includes("21hs")) horarioAtual = "21hs";

            // Se for uma linha de resultado (começa com 1°)
            if (primeiraCelula === "1°") {
                for (let col = 1; col < linha.length; col++) {
                    const dataFormatada = formatarDataPlanilha(cabecalho[col]);
                    if (dataFormatada && horarioAtual) {
                        if (!resultadosPorData[dataFormatada]) resultadosPorData[dataFormatada] = {};
                        resultadosPorData[dataFormatada][horarioAtual] = linha[col];
                    }
                }
            }
        });

        // 3. Salvar no Firebase
        document.getElementById('status').innerText = "⏳ Salvando múltiplas datas...";
        for (const dataKey in resultadosPorData) {
            await setDoc(doc(db, "resultados_jb", dataKey), {
                ...resultadosPorData[dataKey],
                atualizadoEm: new Date().toISOString()
            });
        }

        document.getElementById('status').innerText = "✅ Todas as datas importadas!";
        alert("Planilha processada com sucesso!");
    };
    reader.readAsArrayBuffer(file);
});

// A função buscarResultados e analisarComIA continuam iguais às anteriores
async function buscarResultados() {
    const dataAlvo = document.getElementById('filtroData').value;
    const grid = document.getElementById('gridResultados');
    grid.innerHTML = "Buscando...";

    const docSnap = await getDoc(doc(db, "resultados_jb", dataAlvo));
    if (docSnap.exists()) {
        const d = docSnap.data();
        const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
        grid.innerHTML = horas.map(h => `
            <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center">
                <span class="text-xs font-bold text-blue-600 uppercase">${h}</span>
                <p class="text-2xl font-black text-slate-800">${d[h] || '---'}</p>
            </div>
        `).join('');
    } else {
        grid.innerHTML = "<p class='col-span-full'>Nenhum dado para " + dataAlvo + "</p>";
    }
}
document.getElementById('btnFiltrar').addEventListener('click', buscarResultados);