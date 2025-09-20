const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
});

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' }
});

const Subject = sequelize.define('Subject', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    hours: { type: DataTypes.INTEGER, allowNull: false }, 
    type: { type: DataTypes.ENUM('лекция', 'практика', 'семинар', 'лабораторная'), allowNull: false },
    isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const Department = sequelize.define('Department', {
    name: { type: DataTypes.STRING, allowNull: false },
    faculty: { type: DataTypes.STRING, allowNull: false },
    head: { type: DataTypes.STRING },
});

const Field = sequelize.define('Field', {
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
});

const Teacher = sequelize.define('Teacher', {
    name: { type: DataTypes.STRING, allowNull: false },
    position: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
});

Subject.belongsTo(Department);
Subject.belongsTo(Field);
Subject.belongsTo(Teacher);
Department.hasMany(Subject);
Field.hasMany(Subject);
Teacher.hasMany(Subject);

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.session.user || !roles.includes(req.session.user.role)) {
            return res.status(403).send('Доступ запрещен');
        }
        next();
    };
};

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await User.findOne({ where: { username } });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role
            };
            res.redirect('/');
        } else {
            res.render('login', { error: 'Неверные учетные данные' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/register', async (req, res) => {
    const { username, password, role = 'user' } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, role });
        res.redirect('/login');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { error: 'Ошибка регистрации' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/', requireAuth, async (req, res) => {
    try {
        const subjects = await Subject.findAll({
            include: [Department, Field, Teacher],
        });
        res.render('index', { 
            subjects,
            user: req.session.user 
        });
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/add-department', requireAuth, requireRole(['admin']), (req, res) => {
    res.render('add-department', { user: req.session.user });
});

app.get('/add-field', requireAuth, requireRole(['admin']), (req, res) => {
    res.render('add-field', { user: req.session.user });
});

app.get('/add-teacher', requireAuth, requireRole(['admin']), (req, res) => {
    res.render('add-teacher', { user: req.session.user });
});

app.get('/add-subject', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const departments = await Department.findAll();
        const fields = await Field.findAll();
        const teachers = await Teacher.findAll();
        res.render('add-subject', { 
            departments, 
            fields, 
            teachers,
            user: req.session.user 
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/edit-subject/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const subjectId = req.params.id;
        const subject = await Subject.findByPk(subjectId, {
            include: [Department, Field, Teacher],
        });
        if (!subject) {
            return res.status(404).send('Subject not found');
        }
        const departments = await Department.findAll();
        const fields = await Field.findAll();
        const teachers = await Teacher.findAll();
        res.render('edit-subject', { 
            subject, 
            departments, 
            fields, 
            teachers,
            user: req.session.user 
        });
    } catch (error) {
        console.error('Error fetching subject for edit:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/add-department', requireAuth, requireRole(['admin']), async (req, res) => {
    const { name, faculty, head } = req.body;
    if (name && faculty) {
        await Department.create({ name, faculty, head });
    }
    res.redirect('/');
});

app.post('/add-field', requireAuth, requireRole(['admin']), async (req, res) => {
    const { name, code, description } = req.body;
    if (name) {
        await Field.create({ name, code, description });
    }
    res.redirect('/');
});

app.post('/add-teacher', requireAuth, requireRole(['admin']), async (req, res) => {
    const { name, position, email, phone } = req.body;
    if (name && position) {
        await Teacher.create({ name, position, email, phone });
    }
    res.redirect('/');
});

app.post('/add-subject', requireAuth, requireRole(['admin']), async (req, res) => {
    const { name, price, hours, type, departmentId, fieldId, teacherId, isAvailable } = req.body;

    if (name && price && hours && type && departmentId && fieldId && teacherId) {
        try {
            await Subject.create({
                name,
                price: parseFloat(price),
                hours: parseInt(hours),
                type,
                DepartmentId: departmentId,
                FieldId: fieldId,
                TeacherId: teacherId,
                isAvailable: isAvailable === 'on'
            });
            res.redirect('/');
        } catch (error) {
            console.error('Error adding subject:', error);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.status(400).send('Все поля обязательны для заполнения');
    }
});

app.post('/delete-subject/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const subjectId = req.params.id;
        await Subject.destroy({
            where: { id: subjectId },
        });
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/edit-subject/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const subjectId = req.params.id;
        const { name, price, hours, type, departmentId, fieldId, teacherId, isAvailable } = req.body;

        await Subject.update(
            {
                name,
                price: parseFloat(price),
                hours: parseInt(hours),
                type,
                DepartmentId: departmentId,
                FieldId: fieldId,
                TeacherId: teacherId,
                isAvailable: isAvailable === 'on'
            },
            { where: { id: subjectId } }
        );
        res.redirect('/');
    } catch (error) {
        console.error('Error updating subject:', error);
        res.status(500).send('Internal Server Error');
    }
});

(async () => {
    try {
        await sequelize.sync({ force: true });

        const hashedAdminPassword = await bcrypt.hash('admin123', 10);
        const hashedUserPassword = await bcrypt.hash('user123', 10);

        await User.create({
            username: 'admin',
            password: hashedAdminPassword,
            role: 'admin'
        });

        await User.create({
            username: 'user',
            password: hashedUserPassword,
            role: 'user'
        });

        const dept1 = await Department.create({ 
            name: 'Кафедра информатики', 
            faculty: 'Факультет компьютерных наук',
            head: 'Иванов И.И.'
        });
        const dept2 = await Department.create({ 
            name: 'Кафедра математики', 
            faculty: 'Факультет естественных наук',
            head: 'Петров П.П.'
        });
        const dept3 = await Department.create({ 
            name: 'Кафедра физики', 
            faculty: 'Факультет естественных наук',
            head: 'Сидоров С.С.'
        });

        const field1 = await Field.create({ 
            name: 'Программирование', 
            code: 'IT-001',
            description: 'Направление программирования и разработки ПО'
        });
        const field2 = await Field.create({ 
            name: 'Математический анализ', 
            code: 'MATH-002',
            description: 'Математическое направление'
        });
        const field3 = await Field.create({ 
            name: 'Физика твердого тела', 
            code: 'PHYS-003',
            description: 'Физическое направление'
        });

        const teacher1 = await Teacher.create({ 
            name: 'Алексеев А.А.', 
            position: 'Профессор',
            email: 'alekseev@university.ru',
            phone: '+7 (999) 123-45-67'
        });
        const teacher2 = await Teacher.create({ 
            name: 'Борисов Б.Б.', 
            position: 'Доцент',
            email: 'borisov@university.ru',
            phone: '+7 (999) 234-56-78'
        });
        const teacher3 = await Teacher.create({ 
            name: 'Васильев В.В.', 
            position: 'Старший преподаватель',
            email: 'vasiliev@university.ru',
            phone: '+7 (999) 345-67-89'
        });

        await Subject.create({
            name: 'Введение в программирование',
            price: 15000,
            hours: 72,
            type: 'лекция',
            DepartmentId: dept1.id,
            FieldId: field1.id,
            TeacherId: teacher1.id
        });

        await Subject.create({
            name: 'Алгоритмы и структуры данных',
            price: 20000,
            hours: 96,
            type: 'практика',
            DepartmentId: dept1.id,
            FieldId: field1.id,
            TeacherId: teacher2.id
        });

        await Subject.create({
            name: 'Математический анализ',
            price: 18000,
            hours: 84,
            type: 'семинар',
            DepartmentId: dept2.id,
            FieldId: field2.id,
            TeacherId: teacher3.id
        });

        await Subject.create({
            name: 'Физика полупроводников',
            price: 17000,
            hours: 78,
            type: 'лабораторная',
            DepartmentId: dept3.id,
            FieldId: field3.id,
            TeacherId: teacher1.id,
            isAvailable: false
        });

        console.log('База данных инициализирована с тестовыми данными');
        app.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
    }
})();