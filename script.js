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

// FUNÇÃO PARA FORMATAR COMO DD/MM/AAAA
function extrairDataBR(texto) {
    if (!texto) return null;
    let s = String(texto).toLowerCase().trim();
    const match = s.match(/(\d+)/);
    if (!match) return null;
    
    const diaNum = parseInt(match[0]);
    if (diaNum < 1 || diaNum > 31 || match[0].length > 2) return null;
    
    const dia = String(diaNum).padStart(2, '0');
    let mes = "09"; // Setembro
    if (s.includes("out")) mes = "10";
    if (s.includes("nov")) mes = "11";
    if (s.includes("dez")) mes = "12";
    
    // RETORNA NO FORMATO BRASILEIRO
    return `${dia}/${mes}/2024`;
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

            let resultadosPorData = {};
            let mapaColunas = {};
            let horarioAtual = "";

            for (let r = 0; r < 10; r++) {
                if (!matriz[r]) continue;
                matriz[r].forEach((celula, cIdx) => {
                    const idData = extrairDataBR(celula);
                    if (idData && !mapaColunas[cIdx]) {
                        mapaColunas[cIdx] = idData;
                        console.log(`Data detectada: ${idData}`);
                    }
                });
            }

            matriz.forEach(linha => {
                const primeira = String(linha[0] || "").toLowerCase();
                if (primeira.includes("9h")) horarioAtual = "9hs";
                else if (primeira.includes("11h")) horarioAtual = "11hs";
                else if (primeira.includes("14h")) horarioAtual = "14hs";
                else if (primeira.includes("16h")) horarioAtual = "16hs";
                else if (primeira.includes("18h")) horarioAtual = "18hs";
                else if (primeira.includes("21h")) horarioAtual = "21hs";

                if ((primeira.startsWith("1") || primeira.includes("1°")) && horarioAtual) {
                    linha.forEach((valor, cIdx) => {
                        const dataID = mapaColunas[cIdx];
                        if (dataID && valor && cIdx > 0) {
                            if (!resultadosPorData[dataID]) resultadosPorData[dataID] = {};
                            resultadosPorData[dataID][horarioAtual] = String(valor).trim();
                        }
                    });
                }
            });

            document.getElementById('status').innerText = "⏳ Salvando dados...";
            for (const id in resultadosPorData) {
                await setDoc(doc(db, "resultados_jb", id), {
                    ...resultadosPorData[id],
                    atualizadoEm: new Date().toISOString()
                });
            }

            document.getElementById('status').innerText = "✅ Importado com sucesso!";
            alert("Sucesso! Agora você pode buscar usando o formato DD/MM/AAAA.");

        } catch (err) {
            console.error(err);
            alert("Erro: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
});

// BUSCA ADAPTADA PARA O FORMATO BR
document.getElementById('btnFiltrar').addEventListener('click', async () => {
    let dataInput = document.getElementById('filtroData').value; 
    
    // Se o input de data retornar AAAA-MM-DD (padrão do navegador), vamos inverter
    if (dataInput.includes("-")) {
        const partes = dataInput.split("-"); // [2024, 09, 02]
        dataInput = `${partes[2]}/${partes[1]}/${partes[0]}`; // 02/09/2024
    }

    const grid = document.getElementById('gridResultados');
    grid.innerHTML = "Buscando...";

    try {
        const docSnap = await getDoc(doc(db, "resultados_jb", dataInput));
        if (docSnap.exists()) {
            const d = docSnap.data();
            const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
            grid.innerHTML = horas.map(h => `
                <div class="bg-white p-4 rounded-xl border-2 border-blue-500 shadow-md text-center">
                    <span class="text-xs font-bold text-blue-600 uppercase">${h}</span>
                    <p class="text-3xl font-black text-slate-800">${d[h] || '---'}</p>
                </div>
            `).join('');
        } else {
            grid.innerHTML = `<div class="col-span-full p-4 bg-yellow-50 text-center">Nenhum dado para ${dataInput}. Tente importar a planilha novamente.</div>`;
        }
    } catch (e) {
        grid.innerHTML = "Erro ao buscar.";
    }
});