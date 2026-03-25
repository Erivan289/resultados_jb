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

// Configuração da IA - Versão estável para evitar Erro 404
const genAI = new GoogleGenerativeAI("AIzaSyBoXxJigJgxRytRuERGYGygVYY0Vv-g9tU");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const status = document.getElementById('status');
const gridResultados = document.getElementById('gridResultados');
const filtroData = document.getElementById('filtroData');

// 1. IMPORTAR E SALVAR
document.getElementById('btnImportar').addEventListener('click', () => {
    const file = document.getElementById('inputExcel').files[0];
    if (!file) return alert("Selecione o arquivo!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        status.innerText = "⏳ Gravando no banco...";

        for (const row of jsonData) {
            // Se não houver coluna 'data', usamos a do calendário
            const dataDoc = row.data || row.Data || filtroData.value;
            if (!dataDoc) continue;

            // MAPEAMENTO ULTRA-FLEXÍVEL (Lê nomes ou posição das colunas)
            const valores = Object.values(row); 
            const dadosParaSalvar = {
                "9hs": row["9hs"] || row["9h"] || valores[1] || "",
                "11hs": row["11hs"] || row["11h"] || valores[2] || "",
                "14hs": row["14hs"] || row["14h"] || valores[3] || "",
                "16hs": row["16hs"] || row["16h"] || valores[4] || "",
                "18hs": row["18hs"] || row["18h"] || valores[5] || "",
                "21hs": row["21hs"] || row["21h"] || valores[6] || "",
                atualizadoEm: new Date().toISOString()
            };

            await setDoc(doc(db, "resultados_jb", dataDoc), dadosParaSalvar);
        }
        status.innerText = "✅ Importado! Agora clique em VER RESULTADOS.";
        analisarComIA(jsonData);
    };
    reader.readAsArrayBuffer(file);
});

// 2. BUSCAR E MOSTRAR NA TELA (O que resolve os "---")
async function buscarResultados() {
    const dataAlvo = filtroData.value;
    gridResultados.innerHTML = "Buscando...";

    const docSnap = await getDoc(doc(db, "resultados_jb", dataAlvo));
    if (docSnap.exists()) {
        const d = docSnap.data();
        const horas = ["9hs", "11hs", "14hs", "16hs", "18hs", "21hs"];
        
        gridResultados.innerHTML = horas.map(h => `
            <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm text-center">
                <span class="text-xs font-bold text-blue-600 uppercase">${h}</span>
                <p class="text-2xl font-black text-slate-800">${d[h] || '---'}</p>
            </div>
        `).join('');
    } else {
        gridResultados.innerHTML = "<p class='col-span-full'>Nenhum dado encontrado para esta data.</p>";
    }
}

document.getElementById('btnFiltrar').addEventListener('click', buscarResultados);

// 3. IA SEM TRAVAR
async function analisarComIA(dados) {
    const campo = document.getElementById('campo-analise');
    const container = document.getElementById('container-analise');
    try {
        if(container) container.classList.remove('hidden');
        const result = await model.generateContent("Analise estes resultados e me dê as tendências: " + JSON.stringify(dados));
        const response = await result.response;
        if(campo) campo.innerHTML = response.text().replace(/\n/g, '<br>');
    } catch (e) {
        if(campo) campo.innerText = "IA em manutenção. Os dados acima foram salvos!";
    }
}