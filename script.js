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

// FUNÇÃO QUE GARANTE O FORMATO AAAA-MM-DD
function formatarParaID(texto) {
    if (!texto) return null;
    let s = String(texto).toLowerCase().trim();
    
    // Pega apenas os números (ex: de "2-set" pega "2")
    const numeros = s.match(/\d+/);
    if (!numeros) return null;
    
    const dia = numeros[0].padStart(2, '0');
    let mes = "09"; // Setembro por padrão
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

            let resultadosPorData = {};
            let mapaColunas = {};
            let horarioAtual = "";

            // 1. Identifica as datas nas primeiras linhas
            for (let r = 0; r < 10; r++) {
                if (!matriz[r]) continue;
                matriz[r].forEach((celula, cIdx) => {
                    const idData = formatarParaID(celula);
                    if (idData && !mapaColunas[cIdx]) {
                        mapaColunas[cIdx] = idData;
                        console.log(`Coluna ${cIdx} detectada como data: ${idData}`);
                    }
                });
            }

            // 2. Varre os prêmios
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

            // 3. Salva no Banco
            for (const id in resultadosPorData) {
                await setDoc(doc(db, "resultados_jb", id), {
                    ...resultadosPorData[id],
                    atualizadoEm: new Date().toISOString()
                });
            }

            document.getElementById('status').innerText = "✅ Banco de Dados Atualizado!";
            alert("Sucesso! Agora busque por 02/09/2024.");

        } catch (err) {
            console.error(err);
            alert("Erro: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
});

// BUSCA (IGUAL AO FORMATO DO CALENDÁRIO)
document.getElementById('btnFiltrar').addEventListener('click', async () => {
    const dataBusca = document.getElementById('filtroData').value; // Vem como "2024-09-02"
    const grid = document.getElementById('gridResultados');
    grid.innerHTML = "Buscando...";

    const docSnap = await getDoc(doc(db, "resultados_jb", dataBusca));
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
        grid.innerHTML = `<div class="col-span-full p-4 bg-red-100 text-red-700 rounded-lg">Não encontramos nada para ${dataBusca} no banco de dados.</div>`;
    }
});