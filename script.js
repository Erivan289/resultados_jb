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

// FUNÇÃO PARA CONVERTER DATAS (Ex: "2-set", "02/09", "2-setembro")
function normalizarData(texto) {
    if (!texto) return null;
    const s = String(texto).toLowerCase().trim();
    const diaMatch = s.match(/(\d+)/); // Pega o número do dia
    if (!diaMatch) return null;
    
    const dia = diaMatch[0].padStart(2, '0');
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
            let horarioAtual = "";

            // O segredo: Percorrer linha por linha da planilha
            matriz.forEach((linha, indexLinha) => {
                const primeiraColuna = String(linha[0] || "").toLowerCase();

                // Detecta qual horário estamos lendo no momento
                if (primeiraColuna.includes("9h")) horarioAtual = "9hs";
                else if (primeiraColuna.includes("11h")) horarioAtual = "11hs";
                else if (primeiraColuna.includes("14h")) horarioAtual = "14hs";
                else if (primeiraColuna.includes("16h")) horarioAtual = "16hs";
                else if (primeiraColuna.includes("18h")) horarioAtual = "18hs";
                else if (primeiraColuna.includes("21h")) horarioAtual = "21hs";

                // Se a linha começar com "1°" ou "1", é o resultado que queremos!
                if (primeiraColuna.startsWith("1") && horarioAtual) {
                    // Percorre as colunas dessa linha (as datas)
                    linha.forEach((celula, indexCol) => {
                        if (indexCol === 0) return; // Pula a primeira coluna (que é o "1°")
                        
                        // Busca a data lá no topo da planilha (Linha 0 ou 1)
                        const rawData = matriz[0][indexCol] || matriz[1][indexCol];
                        const dataKey = normalizarData(rawData);

                        if (dataKey && celula) {
                            if (!resultadosPorData[dataKey]) resultadosPorData[dataKey] = {};
                            resultadosPorData[dataKey][horarioAtual] = String(celula).trim();
                        }
                    });
                }
            });

            console.log("Dados extraídos:", resultadosPorData);

            // Gravação no Firebase
            document.getElementById('status').innerText = "⏳ Salvando no banco...";
            for (const dataKey in resultadosPorData) {
                await setDoc(doc(db, "resultados_jb", dataKey), {
                    ...resultadosPorData[dataKey],
                    atualizadoEm: new Date().toISOString()
                });
            }

            document.getElementById('status').innerText = "✅ Importado com sucesso!";
            alert("Dados de Setembro carregados!");

        } catch (err) {
            console.error(err);
            alert("Erro ao ler planilha: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
});

// A BUSCA (Igual antes, mas garantindo o campo de texto)
async function buscarResultados() {
    const dataAlvo = document.getElementById('filtroData').value;
    const grid = document.getElementById('gridResultados');
    grid.innerHTML = "<div class='col-span-full text-center'>Buscando...</div>";

    try {
        const docSnap = await getDoc(doc(db, "resultados_jb", dataAlvo));
        if (docSnap.exists()) {
            const d = docSnap.data();
            const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
            grid.innerHTML = horas.map(h => `
                <div class="bg-white p-4 rounded-xl border-2 border-blue-50 shadow-md text-center">
                    <span class="text-xs font-bold text-blue-500 uppercase">${h}</span>
                    <p class="text-3xl font-black text-slate-800">${d[h] || '---'}</p>
                </div>
            `).join('');
        } else {
            grid.innerHTML = `<div class='col-span-full text-center p-8 bg-slate-100 rounded-xl'>Nenhum dado salvo para ${dataAlvo}. Tente importar a planilha de novo.</div>`;
        }
    } catch (e) {
        grid.innerHTML = "Erro na conexão.";
    }
}
document.getElementById('btnFiltrar').addEventListener('click', buscarResultados);