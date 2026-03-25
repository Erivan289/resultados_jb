import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Importação da IA - Usando um link que não trava o script
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai@0.1.1";

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

// Configuração da IA com proteção para não travar o resto do site
let model;
try {
    const genAI = new GoogleGenerativeAI("AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU");
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
} catch (e) {
    console.error("Erro ao iniciar IA, mas o site continuará funcionando:", e);
}

// Elementos do DOM
const inputExcel = document.getElementById('inputExcel');
const btnImportar = document.getElementById('btnImportar');
const status = document.getElementById('status');
const gridResultados = document.getElementById('gridResultados');
const filtroData = document.getElementById('filtroData');

// FUNÇÃO DE IMPORTAÇÃO
btnImportar.addEventListener('click', () => {
    const file = inputExcel.files[0];
    if (!file) {
        alert("Selecione o arquivo primeiro!");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            status.innerText = "⏳ Gravando resultados no banco...";
            
            for (const row of jsonData) {
                const dataDoc = row.data || row.Data || filtroData.value;
                if (!dataDoc) continue;

                // Mapeamento inteligente (Nomes ou Colunas vazias do Excel)
                const dadosParaSalvar = {
                    "9hs": row["9hs"] || row["9h"] || row["__EMPTY_1"] || "",
                    "11hs": row["11hs"] || row["11h"] || row["__EMPTY_2"] || "",
                    "14hs": row["14hs"] || row["14h"] || row["__EMPTY_3"] || "",
                    "16hs": row["16hs"] || row["16h"] || row["__EMPTY_4"] || "",
                    "18hs": row["18hs"] || row["18h"] || row["__EMPTY_5"] || "",
                    "21hs": row["21hs"] || row["21h"] || row["__EMPTY_6"] || "",
                    atualizadoEm: new Date().toISOString()
                };

                await setDoc(doc(db, "resultados_jb", dataDoc), dadosParaSalvar);
            }
            
            status.innerText = "✅ Sucesso! Agora clique em 'Ver Resultados'.";
            status.className = "text-green-600 font-bold mt-2";

            // Tenta chamar a IA, mas se falhar, não trava o sucesso acima
            analisarComIA(jsonData).catch(err => console.log("IA indisponível no momento."));

        } catch (err) {
            console.error(err);
            status.innerText = "❌ Erro ao ler a planilha.";
        }
    };
    reader.readAsArrayBuffer(file);
});

// FUNÇÃO PARA BUSCAR (Onde as caixinhas aparecem)
async function buscarResultados() {
    const dataAlvo = filtroData.value;
    gridResultados.innerHTML = "Carregando...";

    try {
        const docSnap = await getDoc(doc(db, "resultados_jb", dataAlvo));
        if (docSnap.exists()) {
            const d = docSnap.data();
            const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
            gridResultados.innerHTML = horas.map(h => `
                <div class="bg-white p-4 rounded-xl border shadow-sm">
                    <span class="text-xs font-bold text-blue-600">${h}</span>
                    <p class="text-xl font-black">${d[h] || '---'}</p>
                </div>
            `).join('');
        } else {
            gridResultados.innerHTML = "Nenhum dado para esta data.";
        }
    } catch (e) {
        gridResultados.innerHTML = "Erro ao buscar.";
    }
}

document.getElementById('btnFiltrar').addEventListener('click', buscarResultados);

async function analisarComIA(dados) {
    if (!model) return;
    const campo = document.getElementById('campo-analise');
    const container = document.getElementById('container-analise');
    
    if(container) container.classList.remove('hidden');
    if(campo) campo.innerText = "Analisando tendências de 01/09...";

    const result = await model.generateContent("Analise os resultados: " + JSON.stringify(dados));
    const response = await result.response;
    if(campo) campo.innerHTML = response.text().replace(/\n/g, '<br>');
}