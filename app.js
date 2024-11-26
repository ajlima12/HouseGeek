const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require("firebase-admin/firestore");
const exphbs = require("express-handlebars");
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');

// Inicialização do Firebase Admin
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const app = express();

// Configurações para arquivos estáticos
app.use('/assets', express.static(__dirname + '/assets'));
app.use('/style', express.static(__dirname + '/style'));

// Configuração do motor de visualização (Handlebars)
app.engine("handlebars", exphbs.create({ defaultLayout: "main" }).engine);
app.set("view engine", "handlebars");
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'seuSegredoAqui',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Inicialização do servidor
const PORT = process.env.PORT || 4080;
app.listen(PORT, () => {
    console.log(`Servidor ativo na porta ${PORT}`);
});

// Rotas
app.get("/", async (req, res) => {
    try {
        // Obter dados da coleção "revistas"
        const revistaSnapshot = await db.collection("revistas").get();

        // Mapear os documentos da coleção
        const revistas = revistaSnapshot.docs.map(doc => ({
            id: doc.id,
            imagem: doc.data().imagem,
            titulo: doc.data().titulo,
            descricao: doc.data().descricao,
            preco: doc.data().preco
        }));

        // Verificar se os dados foram obtidos
        if (revistas.length === 0) {
            console.log("Nenhuma revista encontrada.");
        } else {
            console.log("Revistas carregadas:", revistas);
        }

        // Renderizar a página inicial com os dados
        res.render("index", { revistas });
    } catch (error) {
        console.error("Erro ao carregar as HQs:", error.message);
        res.status(500).send("Erro ao carregar a página inicial.");
    }
});

app.get("/crud", (req, res) => {
    res.render("crud");
});


app.get("/cadastro", (req, res) => {
    res.render("cadastro");
});

app.post("/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        const userRecord = await getAuth().createUser({
            email: email,
            password: senha,
            displayName: nome
        });

        await db.collection('users').doc(userRecord.uid).set({
            name: nome,
            email: email,
            createdAt: new Date().toISOString()
        });

        res.redirect("/");
    } catch (error) {
        console.error("Erro ao criar o usuário:", error);
        res.status(500).send("Erro ao cadastrar o usuário.");
    }
});

app.post("/login", async (req, res) => {
    const { email, senha } = req.body;

    try {
        const userRecord = await getAuth().getUserByEmail(email);
        const user = {
            name: userRecord.displayName || "Usuário",
            email: userRecord.email
        };

        req.session.user = user; // Salvar usuário na sessão
        res.redirect("/homeUser");
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        res.status(401).send("Credenciais inválidas");
    }
});

app.post("/cadastro-hq", async (req, res) => {
    console.log("Requisição recebida em /cadastro-hq");
    console.log("Dados recebidos:", req.body); 

    const { autor, descricao, imagem, preco, titulo } = req.body;

    try {
        if (!autor || !descricao || !imagem || !preco || !titulo) {
            console.log("Erro: Todos os campos são obrigatórios."); 
            return res.status(400).send("Todos os campos são obrigatórios.");
        }

        console.log("Inserindo dados na coleção 'revista'..."); 
        const revistaRef = db.collection('revistas').doc(); 
        await revistaRef.set({
            autor: autor,
            descricao: descricao,
            imagem: imagem,
            preco: preco,
            titulo: titulo,
            criadoEm: new Date().toISOString()
        });

        console.log("HQ cadastrada com sucesso!"); 
        res.redirect("/colecao-hqs"); 
    } catch (error) {
        console.error("Erro ao cadastrar HQ:", error); 
        res.status(500).send("Erro ao cadastrar a HQ.");
    }
});

app.get("/colecao-hqs", async (req, res) => {
    try {
        console.log("Consultando HQs para exibição...");
        const revistaSnapshot = await db.collection("revistas").get();

        const revistas = revistaSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Foram encontradas ${revistas.length} HQ(s) para exibição.`);
        res.render("crud", { revistas }); // Renderiza a página 'colecao' com os dados
    } catch (error) {
        console.error("Erro ao consultar as HQs:", error);
        res.status(500).send("Erro ao carregar a coleção de HQs.");
    }
});

// Rota para editar HQ
app.get("/editar-hq/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const revistaDoc = await db.collection("revistas").doc(id).get();
        if (!revistaDoc.exists) {
            return res.status(404).send("HQ não encontrada.");
        }
        const revista = revistaDoc.data();
        res.render("editar-hq", { revista, id });
    } catch (error) {
        console.error("Erro ao buscar HQ para editar:", error);
        res.status(500).send("Erro ao carregar os dados para edição.");
    }
});

// Rota para salvar as alterações de edição
app.post("/editar-hq/:id", async (req, res) => {
    const { id } = req.params;
    const { titulo, autor, descricao, imagem, preco } = req.body;
    try {
        await db.collection("revistas").doc(id).update({
            titulo,
            autor,
            descricao,
            imagem,
            preco
        });
        res.redirect("/colecao-hqs"); // Redireciona de volta para a página de coleções
    } catch (error) {
        console.error("Erro ao salvar alterações:", error);
        res.status(500).send("Erro ao salvar as alterações.");
    }
});

app.post("/excluir-hq/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await db.collection("revistas").doc(id).delete();
        res.redirect("/colecao-hqs"); // Redireciona de volta para a página de coleções
    } catch (error) {
        console.error("Erro ao excluir a HQ:", error);
        res.status(500).send("Erro ao excluir a HQ.");
    }
});



app.post("/login", async (req, res) => {
    const { email, senha } = req.body;

    // Credenciais fixas para o admin
    const adminEmail = "admin@admin.com";
    const adminPassword = "123";

    if (email === adminEmail && senha === adminPassword) {
        return res.redirect("/colecao-hqs");
    }

    try {
        const userRecord = await getAuth().getUserByEmail(email);
        const userRef = db.collection('users').doc(userRecord.uid);

        // Corrigido a duplicação das variáveis
        await userRef.set({
            name: userRecord.displayName || 'Usuário', // Usando nome do usuário se disponível
            email: userRecord.email
        });

        // Armazenando o nome na sessão
        req.session.user = { name: userRecord.displayName || 'Usuário', email: userRecord.email };

        return res.redirect("/homeUser");
    } catch (error) {
        console.error("Erro ao fazer login:", error.message);
        res.status(401).send("Credenciais inválidas");
    }
});

app.get("/homeUser", async (req, res) => {
    try {
        const revistaSnapshot = await db.collection("revistas").get();
        const revistas = revistaSnapshot.docs.map(doc => ({
            id: doc.id,
            imagem: doc.data().imagem,
            titulo: doc.data().titulo,
            descricao: doc.data().descricao,
            preco: doc.data().preco
        }));

        const userName = req.session.user ? req.session.user.name : "Visitante";

        res.render("homeUser", { revistas, name: userName });
    } catch (error) {
        console.error("Erro ao carregar as revistas:", error);
        res.status(500).send("Erro ao carregar a coleção de revistas.");
    }
});
