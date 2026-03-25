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

// Função para converter "2-set" ou "2seg" em "2024-09-02"
function extrairData(texto) {
    if (!texto) return null;
    const s = String(texto).toLowerCase();
    const match = s.match(/(\d+)/); // Pega o primeiro número (o dia)
    if (!match) return null;
    
    const dia = match[0].padStart(2, '0');
    let mes = "09"; // Padrão Setembro
    if (s.includes("out")) mes = "10";
    if (s.includes("nov")) mes = "11";
    if (s.includes("dez")) mes = "12";
    
    return `2024-${mes}-${dia}`;
}

document.getElementById('btnImportar').addEventListener('click', () => {
    const file = document.getElementById('inputExcel').files[0];
    if (!file) return alert("Selecione o arquivo!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const resultadosPorData = {};
            let mapaColunasDatas = {}; // Guarda qual coluna é qual dia
            let horarioAtual = "";

            // PASSO 1: Descobrir em quais colunas estão as datas (Varrendo as primeiras 5 linhas)
            for (let i = 0; i < 5; i++) {
                if (!matriz[i]) continue;
                matriz[i].forEach((celula, colIdx) => {
                    const dataFormatada = extrairData(celula);
                    if (dataFormatada && !mapaColunasDatas[colIdx]) {
                        mapaColunasDatas[colIdx] = dataFormatada;
                    }
                });
            }

            // PASSO 2: Varrer a planilha atrás dos horários e prêmios
            matriz.forEach((linha) => {
                const primeiraCel = String(linha[0] || "").toLowerCase();

                if (primeiraCel.includes("9h")) horarioAtual = "9hs";
                else if (primeiraCel.includes("11h")) horarioAtual = "11hs";
                else if (primeiraCel.includes("14h")) horarioAtual = "14hs";
                else if (primeiraCel.includes("16h")) horarioAtual = "16hs";
                else if (primeiraCel.includes("18h")) horarioAtual = "18hs";
                else if (primeiraCel.includes("21h")) horarioAtual = "21hs";

                // Se a linha é de resultado (começa com "1°" ou "1")
                if (primeiraCel.startsWith("1") && horarioAtual) {
                    linha.forEach((valor, colIdx) => {
                        const dataDaColuna = mapaColunasDatas[colIdx];
                        if (dataDaColuna && valor && colIdx > 0) {
                            if (!resultadosPorData[dataDaColuna]) resultadosPorData[dataDaColuna] = {};
                            resultadosPorData[dataDaColuna][horarioAtual] = String(valor).trim();
                        }
                    });
                }
            });

            // PASSO 3: Salvar no Firebase
            const status = document.getElementById('status');
            status.innerText = "⏳ Gravando dados de Setembro...";
            
            for (const dataKey in resultadosPorData) {
                await setDoc(doc(db, "resultados_jb", dataKey), {
                    ...resultadosPorData[dataKey],
                    atualizadoEm: new Date().toISOString()
                });
            }

            status.innerText = "✅ Importado com sucesso!";
            alert("Sucesso! Verifique os dias 02, 03, 04 de Setembro.");

        } catch (err) {
            console.error(err);
            alert("Erro ao processar: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
});

// A função de busca permanece a mesma (btnFiltrar)
async function buscarResultados() {
    const dataAlvo = document.getElementById('filtroData').value;
    const grid = document.getElementById('gridResultados');
    grid.innerHTML = "Buscando...";

    const docSnap = await getDoc(doc(db, "resultados_jb", dataAlvo));
    if (docSnap.exists()) {
        const d = docSnap.data();
        const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
        grid.innerHTML = horas.map(h => `
            <div class="bg-white p-4 rounded-xl border-2 border-blue-100 shadow-sm text-center">
                <span class="text-xs font-bold text-blue-600 uppercase">${h}</span>
                <p class="text-2xl font-black text-slate-800">${d[h] || '---'}</p>
            </div>
        `).join('');
    } else {
        grid.innerHTML = `<div class="col-span-full text-center p-4 bg-yellow-50 text-yellow-700 rounded-lg">Nenhum dado salvo para ${dataAlvo}.</div>`;
    }
}
document.getElementById('btnFiltrar').addEventListener('click', buscarResultados);