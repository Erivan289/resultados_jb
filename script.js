import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.1.0";

// Configuração do seu Firebase
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

// FUNÇÃO PARA LIMPAR E VALIDAR DATAS (Evita 2024-09-46022)
function extrairData(texto) {
    if (!texto) return null;
    let s = String(texto).toLowerCase().trim();
    
    // Procura por números no texto (ex: "2-set" -> 2)
    const match = s.match(/(\d+)/);
    if (!match) return null;
    
    const diaNum = parseInt(match[0]);

    // TRAVA DE SEGURANÇA: Só aceita dias entre 1 e 31
    // Ignora números longos que são resultados do jogo (ex: 4017)
    if (diaNum < 1 || diaNum > 31 || match[0].length > 2) return null;
    
    const dia = String(diaNum).padStart(2, '0');
    let mes = "09"; // Setembro padrão para a sua planilha atual
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

            // 1. Identifica as colunas de data (Varrendo as primeiras 10 linhas para segurança)
            for (let r = 0; r < 10; r++) {
                if (!matriz[r]) continue;
                matriz[r].forEach((celula, cIdx) => {
                    const idData = extrairData(celula);
                    if (idData && !mapaColunas[cIdx]) {
                        mapaColunas[cIdx] = idData;
                        console.log(`Coluna ${cIdx} detectada como data válida: ${idData}`);
                    }
                });
            }

            // 2. Varre os prêmios por blocos de horários
            matriz.forEach(linha => {
                const primeira = String(linha[0] || "").toLowerCase();
                
                // Define o horário atual conforme encontra as marcações na primeira coluna
                if (primeira.includes("9h")) horarioAtual = "9hs";
                else if (primeira.includes("11h")) horarioAtual = "11hs";
                else if (primeira.includes("14h")) horarioAtual = "14hs";
                else if (primeira.includes("16h")) horarioAtual = "16hs";
                else if (primeira.includes("18h")) horarioAtual = "18hs";
                else if (primeira.includes("21h")) horarioAtual = "21hs";

                // Se a linha for o 1° Prêmio, salva os valores nas colunas correspondentes
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

            // 3. Gravação no Firebase
            const statusLabel = document.getElementById('status');
            statusLabel.innerText = "⏳ Atualizando banco de dados...";

            for (const id in resultadosPorData) {
                await setDoc(doc(db, "resultados_jb", id), {
                    ...resultadosPorData[id],
                    atualizadoEm: new Date().toISOString()
                });
            }

            statusLabel.innerText = "✅ Importação Concluída!";
            alert("Dados de Setembro carregados com sucesso!");

        } catch (err) {
            console.error("Erro no processamento:", err);
            alert("Erro ao ler planilha: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
});

// FUNÇÃO DE BUSCA E EXIBIÇÃO
document.getElementById('btnFiltrar').addEventListener('click', async () => {
    const dataBusca = document.getElementById('filtroData').value; 
    const grid = document.getElementById('gridResultados');
    
    if (!dataBusca) return alert("Selecione uma data no calendário!");
    
    grid.innerHTML = "<div class='col-span-full text-center'>Buscando resultados...</div>";

    try {
        const docSnap = await getDoc(doc(db, "resultados_jb", dataBusca));
        
        if (docSnap.exists()) {
            const d = docSnap.data();
            const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
            
            grid.innerHTML = horas.map(h => `
                <div class="bg-white p-4 rounded-xl border-2 border-blue-500 shadow-lg text-center transform hover:scale-105 transition-all">
                    <span class="text-xs font-bold text-blue-600 uppercase tracking-widest">${h}</span>
                    <p class="text-3xl font-black text-slate-800 mt-1">${d[h] || '---'}</p>
                </div>
            `).join('');
        } else {
            grid.innerHTML = `
                <div class="col-span-full p-6 bg-red-50 text-red-700 rounded-xl border border-red-200 text-center">
                    <p class="font-bold">Ops! Nenhum dado para ${dataBusca}.</p>
                    <p class="text-sm">Verifique se você importou a planilha correta.</p>
                </div>
            `;
        }
    } catch (e) {
        grid.innerHTML = "<div class='col-span-full text-red-500'>Erro ao conectar com o banco de dados.</div>";
    }
});