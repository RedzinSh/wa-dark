require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cookieParser = require("cookie-parser");
const ejs = require("ejs");
const multer = require('multer');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");

const PORT = 3000;

const USERS_FILE = './servidor/users.json';
const MESSAGES_FILE = './servidor/messages.json';
const UPLOAD_DIR = './servidor/uploads/';

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Funções para leitura e escrita de usuários e mensagens
const readUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE);
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

const readMessages = () => {
    try {
        const data = fs.readFileSync(MESSAGES_FILE);
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeMessages = (messages) => {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas
app.get('/er', (req, res) => {
    const htmlPath = path.join(__dirname, './client/index.html');
    res.sendFile(htmlPath);
});

app.get('/perfil', (req, res) => {
    const htmlPath = path.join(__dirname, './views/config.html');
    res.sendFile(htmlPath);
});

app.get('/chat', (req, res) => {
    const htmlPath = path.join(__dirname, './views/chat.html');
    res.sendFile(htmlPath);
});

app.get("/home", (req, res) => {
    const { username, password } = req.cookies;
    const users = readUsers();
   const { foto, userCode } = users;
        res.render("home", { username, password, foto, userCode });
});

app.get("/status", (req, res) => {
    const { username, password } = req.cookies;
    const users = readUsers();
   const { foto, userCode } = users;
        //res.render("status", { username, password, foto, userCode });
        res.json({ success: false, message: 'EM DESENVOLVIMENTO....' });
});

app.get("/call", (req, res) => {
    const { username, password } = req.cookies;
    const users = readUsers();
   const { foto, userCode } = users;
        res.render("call", { username, password, foto, userCode });
});

// Rota de registro
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();

    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
        return res.json({ success: false, message: 'Usuário já existe.' });
    }

    const userCode = Math.floor(Math.random() * 10000);
    const fotoPadrao = 'https://telegra.ph/file/cd7be62ea98d28f1ba503.jpg';
    const newUser = {
        username,
        password,
        userCode,
        foto: fotoPadrao,
        bio: 'Olá 👋! estou no WA Dark 💯',
        contacts: []
    };

    users.push(newUser);
    writeUsers(users);

    res.json({ success: true });
});

// Rota de login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();

    const user = users.find(user => user.username === username && user.password === password);
    if (!user) {
        return res.json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    res.json({ success: true, userCode: user.userCode });
});

app.get("/", (req, res) => {
    res.render("index", { message: "" });
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();

    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        res.cookie("username", username, { httpOnly: true });
        return res.json({ success: true, userCode: user.userCode });
    } else {
        return res.json({ success: false, message: 'Usuário ou senha inválidos.' });
    }
});

app.get('/api/getUserByCode/:code', (req, res) => {
    const { code } = req.params;
    const users = readUsers();
    const user = users.find(user => user.userCode === parseInt(code));

    if (user) {
        res.json({ success: true, foto: user.foto, username: user.username, bio: user.bio });
    } else {
        res.json({ success: false, message: 'Usuário não encontrado.' });
    }
});

app.post('/api/updateUser', (req, res) => {
    const { userCode, username, bio, foto } = req.body;
    let users = readUsers();
    const userIndex = users.findIndex(user => user.userCode === parseInt(userCode));

    if (userIndex !== -1) {
        users[userIndex] = {
            ...users[userIndex],
            username,
            bio,
            foto
        };
        writeUsers(users);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Usuário não encontrado.' });
    }
});

// API para adicionar um contato
app.post('/api/addContact', (req, res) => {
    const { userCode, contactCode, contactName, contactImg } = req.body;
    const users = readUsers();

    const userIndex = users.findIndex(user => user.userCode === parseInt(userCode));
    if (userIndex === -1) {
        return res.json({ success: false, message: 'Usuário não encontrado.' });
    }

    const existingContact = users[userIndex].contacts.find(contact => contact.code === parseInt(contactCode));
    if (existingContact) {
        return res.json({ success: false, message: 'Contato já adicionado.' });
    }

    users[userIndex].contacts.push({ code: contactCode, name: contactName, img: contactImg });
    writeUsers(users);

    res.json({ success: true });
});

// API para enviar uma mensagem de texto
app.post('/api/sendMessage', (req, res) => {
    const { from, to, content } = req.body;
    const messages = readMessages();

    const message = { from, to, content, type: 'text', timestamp: new Date() };
    messages.push(message);
    writeMessages(messages);

    res.json({ success: true });
});

// API para enviar uma mensagem de áudio
app.post('/api/sendAudioMessage', upload.single('audio'), (req, res) => {
    const { from, to } = req.body;
    const audioPath = path.join('/uploads', req.file.filename);
    const messages = readMessages();

    const message = { from, to, content: audioPath, type: 'audio', timestamp: new Date() };
    messages.push(message);
    writeMessages(messages);

    res.json({ success: true });
});

// API para obter mensagens entre dois usuários
app.get('/api/messages/:from/:to', (req, res) => {
    const { from, to } = req.params;
    const messages = readMessages();
    const userMessages = messages.filter(
        msg => (msg.from === from && msg.to === to) || (msg.from === to && msg.to === from)
    ).map(msg => {
        const fromUser = readUsers().find(user => user.userCode == msg.from);
        const toUser = readUsers().find(user => user.userCode == msg.to);
        return {
            from: msg.from,
            to: msg.to,
            content: msg.content,
            type: msg.type,
            timestamp: msg.timestamp,
            fromUsername: fromUser.username,
            fromFoto: fromUser.foto,
            toUsername: toUser.username,
            toFoto: toUser.foto
        };
    });

    res.json(userMessages);
});


app.get('/api/getAllUsers', (req, res) => {
    try {
        const users = readUsers();
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Erro ao ler usuários:', error);
        res.json({ success: false, message: 'Erro ao obter usuários.' });
    }
});

// Iniciar o servidor web
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Reiniciar o servidor ao editar
fs.watchFile('./server.js', (curr, prev) => {
    if (curr.mtime.getTime() !== prev.mtime.getTime()) {
        console.log('A index foi editado. Reiniciando...');
        process.exit();
    }
});
