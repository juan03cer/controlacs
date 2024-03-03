const express = require('express');
const app = express();
const multer = require('multer'); // Importar multer
const request = require('request'); // Agregado para manejar las solicitudes HTTP
const btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();
const socketIo = require('socket.io');
const http = require('http');
const server = http.createServer(app); // Crea un servidor HTTP
const io = require('socket.io')(server); //Pasa el servidor HTTP a Socket.IO
const bodyParser = require('body-parser');
const cors = require('cors');
const ExcelJS = require('exceljs');
const path = require('path');



///////////////////////bluetooth/////////////////////////////////
const address = '00:23:05:00:3E:7D';

let idTarjetaBluetooth = '';

btSerial.findSerialPortChannel(address, function(channel) {
    btSerial.connect(address, channel, function() {
        console.log('Conectado al dispositivo Bluetooth');
        btSerial.on('data', function(buffer) {
            try {
                const data = buffer.toString('utf-8');
                console.log('Datos recibidos:', data);
                idTarjetaBluetooth = data;
        
                // Emitir el nuevo valor a los clientes conectados a través de WebSocket
                io.emit('idTarjetaBluetooth', idTarjetaBluetooth);
        
                // Emitir el evento para actualizar la página
                io.emit('updatePage');
            } catch (error) {
                console.error('Error al procesar datos:', error);
            }
        });

    }, function() {
        console.error('Error al conectar al dispositivo Bluetooth');
    });

    btSerial.on('failure', function(err) {
        console.error('Error al encontrar el canal del puerto serial:', err);
    });
});


// Establecer conexión WebSocket para actualizar en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado');

    // Enviar el valor actual al cliente recién conectado
    socket.emit('idTarjetaBluetooth', idTarjetaBluetooth);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});
btSerial.on('data', async function(buffer) {
    try {
        const data = buffer.toString('utf-8').trim();
        console.log('Datos recibidos:', data);

        // Comparar con la base de datos y obtener la información del alumno
        if (data) {
            connection.query('SELECT * FROM alumno WHERE idtarjeta = ?', [data], async (error, results) => {
                if (error) {
                    console.error('Error al buscar en la base de datos:', error);
                } else {
                    const alumnoData = results.length > 0 ? results[0] : null;

                    // Emitir el nuevo valor y la información del alumno a los clientes conectados
                    io.emit('idTarjetaBluetooth', data);
                    io.emit('alumnoData', alumnoData);
                }
            });
        }

        // Emitir el evento para actualizar la página
        io.emit('updatePage');
    } catch (error) {
        console.error('Error al procesar datos:', error);
    }
});


/////////////////////fin de bluetooth////////////////////


// seteamos urlencoded para capturar los ddatos del formulario
app.use(express.urlencoded({extended:false}));
app.use(express.json());

// invocar a dotenv(ubicacion de los datos de la base de datos)
const dotenv = require('dotenv');
dotenv.config({path:'./env/.env'});

// el directorio public
app.use('/public', express.static('public'));
app.use('/public', express.static(__dirname + '/public'));

//establecemos el motor de plantillas
app.set('view engine', 'ejs');

//invocamos a bcryptjs
const bcrypt = require('bcryptjs');

//var. de session
const session = require('express-session');
app.use(session({
    secret:'secret',
    resave: 'true',
    saveUninitialized:true,
    cookie: { maxAge: null }
}));
//invocar la conexion
const connection = require('./database/db')


/////////////rutas//////////////////////////////
app.get('/inicio', (req,res)=>{
    res.render('inicio');
})

app.get('/nosotros', (req,res)=>{
    res.render('nosotros');
})

app.get('/api', (req,res)=>{
    res.render('api');
})

app.get('/redessociales', (req,res)=>{
    res.render('redessociales');
})

app.get('/admin', (req,res)=>{
     res.render('admin');
 })

 app.get('/fotos', (req,res)=>{
    res.render('fotos');
})
//////////////Fin de rutas//////////////////


////////registro con verificación de reCAPTCHA//////////////////////////////////
// Configuraracion multer para guardar las imágenes en la carpeta public/imgs
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/img/admin');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });


const recaptchaSecretKey = '6LdpvDEUAAAAAHszsgB_nnal29BIKDsxwAqEbZzU';
app.post('/inicio', upload.single('foto'), async (req, res) => {
    const nombre = req.body.nombre;
    const lastname = req.body.lastname;
    const correo = req.body.correo;
    const claveempleado = req.body.claveempleado;
    const password = req.body.password;

    const foto = req.file ? req.file.filename : null;
    const recaptchaResponse = req.body['g-recaptcha-response'];

    // Verificar reCAPTCHA
    const recaptchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`;

    request(recaptchaVerifyUrl, async (err, response, body) => {
        try {
            body = JSON.parse(body);

            if (body.success !== undefined && !body.success) {
                return res.render('inicio', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡Verificación reCAPTCHA fallida!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            }

            // Verificar si ya existe un usuario con el mismo correo
            const results = await connection.query('SELECT * FROM administrador WHERE correo = ?', [correo]);

            if (results.length > 0) {
                // Ya existe un usuario con el mismo correo
                return res.render('inicio', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡El correo ya está registrado!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            }

            // No existe un usuario con el mismo correo, proceder con el registro
            const passwordHash = await bcrypt.hash(password, 8);

            await connection.query('INSERT INTO administrador SET ?', {
                nombre: nombre,
                lastname: lastname,
                correo: correo,
                claveempleado: claveempleado,
                foto: foto,
                password: passwordHash
            });

            return res.render('inicio', {
                alert: true,
                alertTitle: "Registro",
                alertMessage: "¡Registro exitoso!",
                alertIcon: 'success',
                showConfirmButton: false,
                timer: 1500,
                ruta: ''
            });

        } catch (error) {
            console.log(error);
            return res.render('inicio', {
                alert: true,
                alertTitle: "Error",
                alertMessage: "¡Ocurrió un error durante el registro!",
                alertIcon: 'error',
                showConfirmButton: false,
                timer: 1500,
                ruta: ''
            });
        }
    });
});
///////////////fin registro con verificación de reCAPTCHA///////////////////////////

//////////////////cambiar la contraseña admin////////////////////
app.post('/cambiar-contrasena', async (req, res) => {
    const correo = req.body.correo;
    const antiguaContrasena = req.body.antiguaContrasena;
    const nuevaContrasena = req.body.nuevaContrasena;

    // Verificar si el usuario con el correo dado existe
    connection.query('SELECT * FROM administrador WHERE correo = ?', [correo], async (error, results) => {
        if (error) {
            console.log(error);
        } else {
            if (results.length > 0) {
                // Usuario encontrado, verificar la antigua contraseña
                const usuario = results[0];
                const isPasswordValid = await bcrypt.compare(antiguaContrasena, usuario.password);

                if (isPasswordValid) {
                    // La antigua contraseña es válida, actualizar la contraseña
                    const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, 8);

                    connection.query('UPDATE administrador SET password = ? WHERE correo = ?', [nuevaContrasenaHash, correo], async (error, results) => {
                        if (error) {
                            console.log(error);
                        } else {
                            res.render('cambiar-contrasena', {
                                alert: true,
                                alertTitle: "Cambio de Contraseña",
                                alertMessage: "¡Contraseña cambiada con éxito!",
                                alertIcon: 'success',
                                showConfirmButton: false,
                                timer: 1500,
                                ruta: ''
                            });
                        }
                    });
                } else {
                    // La antigua contraseña no es válida
                    res.render('cambiar-contrasena', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: "¡La antigua contraseña es incorrecta!",
                        alertIcon: 'error',
                        showConfirmButton: false,
                        timer: 1500,
                        ruta: ''
                    });
                }
            } else {
                // No se encontró ningún usuario con el correo dado
                res.render('cambiar-contrasena', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡Usuario no encontrado!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            }
        }
    });
});
/////////////////fin cambiar la contraseña admin///////////////////////

//////////////////autenticacion para el inicio de sesion//////////////////
app.post('/auth', async (req, res)=> {
	const correo = req.body.correo;
    const password = req.body.password;
    let passwordHash = await bcrypt.hash(password, 8);
    if(correo && password){
        connection.query('SELECT * FROM administrador WHERE correo = ?', [correo], async (error, results)=> {
            if(results.length == 0 || !(await bcrypt.compare(password, results[0].password))){
                res.render('inicio',{
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "USUARIO y/o PASSWORD incorrectas",
                    alertIcon:'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: ''    
                })
            }else{
                req.session.loggedin = true;                
				req.session.nombre = results[0].nombre;
                res.render('inicio',{
                    alert: true,
                    alertTitle: "Conexion exitosa",
                    alertMessage: "Bienvenid@",
                    alertIcon:'success',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''    
                })
            }

        })
    }else{
        res.render('inicio',{
            alert: true,
            alertTitle: "Advertencia",
            alertMessage: "Por favor ingrese un usuario y una password",
            alertIcon:'warning',
            showConfirmButton: true,
            timer: false,
            ruta: ''    
        });
    }
});
//////////////////fin autenticacion para el inicio de sesion//////////////////

//////////////////Rutas con Autenticacion///////////


app.get('/', (req, res) => {
    if (req.session.loggedin) {
        res.render('index', {
            login: true,
            nombre: req.session.nombre,
            foto: `public/img/admin/${req.session.foto}`  
        });
    } else {
        res.redirect('/inicio');
    }
});

app.get('/entradas', (req, res) => {
    if (req.session.loggedin) {
        // Verificar si la ID de tarjeta Bluetooth está presente
        if (!idTarjetaBluetooth) {
            // No hay datos de tarjeta Bluetooth, puedes manejarlo como desees
            res.render('entradas', {
                login: true,
                nombre: req.session.nombre,
                idTarjetaBluetooth: 'Sin datos',
                alumnoData: null  // Enviar null para indicar que no hay datos de alumno
            });
            return;
        }

        // Realizar consulta a la base de datos para obtener los datos del alumno
        connection.query('SELECT * FROM alumno WHERE idtarjeta = ?', [idTarjetaBluetooth], (error, results) => {
            if (error) {
                console.error('Error en la consulta de alumno:', error);
                res.status(500).send('Error en el servidor');
            } else {
                // Renderizar la plantilla con los datos obtenidos
                const alumnoData = results.length > 0 ? results[0] : null;
                res.render('entradas', {
                    login: true,
                    nombre: req.session.nombre,
                    lastname: req.session.lastname,
                    idTarjetaBluetooth: idTarjetaBluetooth,
                    alumnoData: alumnoData 
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});

app.get('/registrar', (req, res) => {
    if (req.session.loggedin) {
        // Realizar consulta a la base de datos para obtener la lista de carreras
        connection.query('SELECT * FROM carrera', (error, carreras) => {
            if (error) {
                console.error('Error en la consulta de carreras:', error);
                res.status(500).send('Error en el servidor');
            } else {
                // Renderizar la plantilla con los datos obtenidos
                res.render('registrar', {
                    login: true,
                    nombre: req.session.nombre,
                    idTarjetaBluetooth: idTarjetaBluetooth || '',
                    carreras: carreras  // Pasa los resultados de la consulta de carreras a la plantilla
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});


app.get('/miperfil',(req, res)=>{
    if(req.session.loggedin){
        res.render('miperfil',{
            login:true,
            nombre:req.session.nombre
        })
    }else{
        res.redirect('/inicio');   
    }
})
app.get('/registros', (req, res) => {
    if (req.session.loggedin) {
        // Utiliza un JOIN para obtener la información de la carrera
        const query = 'SELECT alumno.*, carrera.nombre AS nombre_carrera FROM alumno LEFT JOIN carrera ON alumno.carrera = carrera.id';
        
        connection.query(query, (error, results) => {
            if (error) {
                console.log(error);
                res.send('Error al obtener los datos');
            } else {
                res.render('registros', {
                    login: true,
                    nombre: req.session.nombre,
                    alumnos: results
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});



app.get('/cambiar-contrasena',(req, res)=>{
   if(req.session.loggedin){
          res.render('cambiar-contrasena',{
              login:true,
          })
      }else{
          res.redirect('/inicio');   
      }
  })



//////////fin autenticacion para las demas paginas cuando inicie sesion//////////////////

app.post('/alumnos', async (req, res) => {
    const nombre = req.body.nombre;
    const lastname = req.body.lastname;
    const foto = req.body.foto;
    const matricula = req.body.matricula;
    const correo = req.body.correo;
    const password = req.body.password;
    const idtarjeta = req.body.idtarjeta || idTarjetaBluetooth;
    const carrera = req.body.carrera;

    // Verificar si la idtarjeta ya está registrada
    connection.query('SELECT * FROM alumno WHERE idtarjeta = ?', [idtarjeta], async (errorTarjeta, resultsTarjeta) => {
        if (errorTarjeta) {
            console.log(errorTarjeta);
            res.status(500).send('Error en el servidor');
        } else {
            if (resultsTarjeta.length > 0) {
                // La idtarjeta ya está registrada
                res.render('inicio', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡La tarjeta ya está registrada!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            } else {
                // La idtarjeta no está registrada, proceder con la verificación del correo
                connection.query('SELECT * FROM alumno WHERE correo = ?', [correo], async (errorCorreo, resultsCorreo) => {
                    if (errorCorreo) {
                        console.log(errorCorreo);
                        res.status(500).send('Error en el servidor');
                    } else {
                        if (resultsCorreo.length > 0) {
                            // El correo ya está registrado
                            res.render('inicio', {
                                alert: true,
                                alertTitle: "Error",
                                alertMessage: "¡El correo ya está registrado!",
                                alertIcon: 'error',
                                showConfirmButton: false,
                                timer: 1500,
                                ruta: ''
                            });
                        } else {
                            // El correo no está registrado, proceder con la inserción
                            let passwordHash = await bcrypt.hash(password, 8);
                            connection.query('INSERT INTO alumno SET ?', {
                                nombre: nombre,
                                lastname: lastname,
                                correo: correo,
                                matricula: matricula,
                                foto: foto,
                                idtarjeta: idtarjeta,
                                carrera: carrera,
                                password: passwordHash
                            }, async (errorInsert, resultsInsert) => {
                                if (errorInsert) {
                                    console.log(errorInsert);
                                    res.status(500).send('Error en el servidor');
                                } else {
                                    res.render('inicio', {
                                        alert: true,
                                        alertTitle: "Registro",
                                        alertMessage: "¡Registro exitoso!",
                                        alertIcon: 'success',
                                        showConfirmButton: false,
                                        timer: 1500,
                                        ruta: ''
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }
    });
});

////////////////////fin registrar alumnos//////////////////

///////////// Ruta para eliminar un alumno/////////////////
app.get('/eliminar/:id', (req, res) => {
    if (!req.session.loggedin) {
        res.redirect('/inicio'); 
        return;
    }

    const alumnoId = req.params.id;
    connection.query('DELETE FROM alumno WHERE id = ?', [alumnoId], (error, results) => {
        if (error) {
            console.log(error);
            res.send('Error al eliminar el alumno');
        } else {
            res.redirect('/registros');
        }
    });
});
///////////// fIN Ruta para eliminar un alumno/////////////////

//////////// Ruta para editar un alumno //////////////////////
app.get('/editar/:id', (req, res) => {
    if (!req.session.loggedin) {
        res.redirect('/inicio'); 
        return;
    }

    const alumnoId = req.params.id;
    connection.query('SELECT * FROM alumno WHERE id = ?', [alumnoId], (error, result) => {
        if (error) {
            console.log(error);
            res.send('Error al obtener los datos del alumno');
        } else {
            res.render('editaralumno', { alumno: result[0] });
        }
    });
});

app.post('/editar/:id', async (req, res) => {
    if (!req.session.loggedin) {
        res.redirect('/inicio'); // Redirigir a la página de inicio si no ha iniciado sesión
        return;
    }
    const id = req.params.id;
    const nombre = req.body.nombre;
    const apellido = req.body.apellido;
    const correo = req.body.correo;
   

    connection.query('UPDATE alumno SET nombre = ?, lastname = ?, correo = ? WHERE id = ?', [nombre, apellido, correo, id], (error, result) => {
        if (error) {
            console.log(error);
            res.send('Error al editar el alumno');
        } else {
            res.redirect('/registros');
        }
    });
});

//////////// fiN Ruta para editar un alumno //////////////////////
app.get('/registros/download', (req, res) => {
    if (req.session.loggedin) {
        const query = 'SELECT alumno.*, carrera.nombre AS nombre_carrera FROM alumno LEFT JOIN carrera ON alumno.carrera = carrera.id';

        connection.query(query, (error, results) => {
            if (error) {
                console.log(error);
                res.send('Error al obtener los datos');
            } else {
                
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Registros');

              
                worksheet.columns = [
                    { header: 'Nombre', key: 'nombre', width: 15 },
                    { header: 'Apellido', key: 'lastname', width: 15 },
                    { header: 'Correo', key: 'correo', width: 30 },
                    { header: 'Matricula', key: 'matricula', width: 15 },
                    { header: 'ID tarjeta', key: 'idtarjeta', width: 20 },
                    { header: 'Carrera', key: 'nombre_carrera', width: 40 },
                ];

                results.forEach((alumno) => {
                    worksheet.addRow({
                        nombre: alumno.nombre,
                        lastname: alumno.lastname,
                        correo: alumno.correo,
                        matricula: alumno.matricula,
                        idtarjeta: alumno.idtarjeta || 'Sin datos',
                        nombre_carrera: alumno.nombre_carrera || 'Sin datos',
                    });
                });

               
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=registros.xlsx');

                workbook.xlsx.write(res).then(() => {
                    res.end();
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});

////////////////////////API/////////////////////////////////
app.use(cors());
// Usa body-parser para analizar las solicitudes en formato JSON
app.use(bodyParser.json());
// app.use('/api',index);



app.get('/api/administradores', (req, res) => {
    connection.query('SELECT * FROM administrador', (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener alumnos' });
        } else {
            res.status(200).json(results);
        }
    });
});
 
// Ruta para obtener un administrador por ID
app.get('/api/administradores/:id', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM administrador WHERE id = ?', [id], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener el administrador' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'Administrador no encontrado' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});

// Ruta para obtener todos los alumnos
app.get('/api/alumnos', (req, res) => {
    connection.query('SELECT * FROM alumno', (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener alumnos' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/alumnos/:id', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM alumno WHERE id = ?', [id], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener el alumno' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'Alumno no encontrado' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});

//horas de acceso
app.get('/api/acceso', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM acceso', [id], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener los datos de la tabla de acceso' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'Accesos encontrado' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});

/////////////////Fin de API/////////////////////////////



////////////////////Cerrar Sesion///////////////////////////////
app.get('/logout', function (req, res) {
	req.session.destroy(() => {
	  res.redirect('inicio') // siempre se ejecutará después de que se destruya la sesión
	})
});
/////////////////////Fin Cerrar Sesion///////////////////////////////

////////////////////Servidor//////////////////////
server.listen(3000, () => {
    console.log("El servidor está ejecutándose en el puerto http://localhost:3000");
});
///////////////Fin de servidor////////////////////////////
