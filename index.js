const express = require('express');
const res = require('express/lib/response');
const app = express();


// to permit requests from client side
app.use(express.json());


//to use files from public folder
app.use(express.static('public'));


const port = 3000;


// Multer import
const multer = require('multer');



// firebase import
var admin = require("firebase-admin")
const currentDirectory = __dirname;
var serviceAccount = require(currentDirectory + "/key/entrada-eventos-firebase-adminsdk-dzfs3-51451ce987.json");


const firebase = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://entrada-eventos-default-rtdb.firebaseio.com"
});


let rtdb = firebase.database(); 


// nodemailer import
const nodemailer = require("nodemailer");


// GET METHOD
app.get('/', (req, res) => {
  res.send('index')
  
});

// managing storage 
let diretorio = __dirname + '/uploads/';
const currentDate = Date.now();
const formatedDate = new Date();

let documentos = [];
let documentosToSendInEmail = []

let storage = multer.diskStorage(
  {
    destination: function (req, file, cb) {
      cb(null, diretorio)
    },
    filename: function async (req, file, cb) {
      let filename_l = "";

      let extensao = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
      

      filename_l =  file.fieldname + "_" + "doc_" + currentDate + extensao;
      let path =  "./uploads/" + filename_l;


      documentos.push({nome_do_arquivo: filename_l, extensao, data_de_insercao: formatedDate});
      documentosToSendInEmail.push({filename: filename_l, path});

      cb(null, filename_l)
    }
  }
)

//rotas de gerenciamento de arquivos
  // rota responsável por tratar os documentos do roubo ou furto
  const upload = multer({storage: storage})
  const cpUpload = upload.fields([{name: 'comprovante_residencia'}, {name: 'id_cnh'}, {name: 'cnh_condutor'}, {name: 'comprovante_residencia_condutor'}, {name: 'crv_carro'}, {name: 'homologacao_kitgas'}, {name: 'registro_ocorrencia'}]);
  app.post('/uploadfiles', cpUpload, async (req, res, next) => { 

    // pegando variaveis de texto
    let nome = req.body.nome
    let cpf = req.body.cpf
    let telefone = req.body.telefone
    let email = req.body.email
    let local_date_time = req.body.hora_ocorrencia
    let descricao_ocorrencia = req.body.descricao_ocorrencia ? req.body.descricao_ocorrencia  : ""
  

    // o protocolo é composto pelo timestamp da data corrente + 4 primeiros digitos do cpf
    const char4 = cpf.substring(0,4);
    const protocolo = currentDate + char4;


    // variável que guarda o nome temporário dos arquivos - A ser utilizado no loop
    let descricao_do_arquivo = ""


    // inserindo associado
    let cpfKey = await cpf.replaceAll(".", "");
    cpfKey = await cpfKey.replaceAll("-", "");
    await rtdb.ref('associados/' + cpfKey).set({
        nome,
        telefone,
        email
      }).then(() => { 
        console.log("associado cadastrado");
      });

    let protocoloKey = await protocolo.replace(".", "")
    await rtdb.ref('protocolos/' + protocoloKey).set({
        data: formatedDate,
        associado: cpf,
        documentos,
        terceiros: [],
        dataOcorrencia: local_date_time,
        descricaoOcorrencia: descricao_ocorrencia
      }).then(() => { 
        console.log("protocolo cadastrado");
      });
    
    for(let i = 0; i<documentos.length; i++){
      let idObject = protocolo + "_" + documentos[i].nome_do_arquivo;

      switch (documentos[i].nome_do_arquivo) {
        case "nome":
          descricao_do_arquivo = "Nome do associado"
          break;
        
        case "cpf": 
          descricao_do_arquivo = "CPF do associado"
        break;

        case "comprovante_residencia": 
          descricao_do_arquivo = "comprovante de residência do associado"
          break;

        case "id_cnh": 
          descricao_do_arquivo = "Identidade ou CNH do associado"
          break;

        case "cnh_condutor": 
          descricao_do_arquivo = "CNH do condutor"
          break; 

        case "comprovante_residencia_condutor": 
          descricao_do_arquivo = "Comprovante de residência do condutor"
          break;

        case "crv_veiculo": 
          descricao_do_arquivo = "Documento de compra e venda do veículo"
          break;

        case "homologacao_kitgas": 
          descricao_do_arquivo = "Documento de homologação do kitgás"
          break;


        case "registro_ocorrencia": 
          descricao_do_arquivo = "Registro de ocorrência"
          break;

        default:
          descricao_do_arquivo = "documento não identificado"
          break;
      }

      await rtdb.ref('documentos/' + protocoloKey + "_doc" + i).set({
        nome_do_arquivo: documentos[i].nome_do_arquivo,
        extensao: documentos[i].extensao,
        data_insercao: formatedDate,
        descricao_do_arquivo,
        protocolo
      }).then(() => { 
        console.log("documento " + documentos[i].nome_do_arquivo + " cadastrado");
      });
    }

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "mail.gestaogma.com.br",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'no-reply@gestaogma.com.br', 
      pass: '@Gma123456', 
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false,
    },
  });


  //configurando mensagem
  let htmlBody = "Entrada de um roubo ou furto <br /><br /> " + 
    "Nome: " + nome + "<br />" +  
    "CPF: " + cpf + "<br />" + 
    "Telefone para contato: " + telefone + "<br />" +
    "Data da ocorrência: " + local_date_time + "<br />" + 
    "Descrição do evento: " + descricao_ocorrencia + "";

  let mensagem = {
    from: "no-reply@gestaogma.com.br", // sender address
    to: "eventos2@gestaogma.com.br, eventos@gestaogma.com.br, assistenteeventos@gestaogma.com.br",  // list of receivers
    subject: "Uma nova entrada (roubo ou furto) no eventos foi realizada. Protocolo: " + protocolo, // Subject line
    html: htmlBody, // html body
    attachments: documentosToSendInEmail
  }

  // send mail with defined transport object
  await transporter.sendMail(mensagem, 
    function(err){
      if(err){
        console.log(err)
      }else{
        console.log("tudo certo")
      }
    });

    res.redirect('/protocolo?protocolo=' + protocolo )
  });

  // rota responsável por tratar os documentos da colisão
  const uploadColisao = multer({storage: storage})
  const cpUploadColisao = upload.fields([{name: 'comprovante_residencia_colisao'}, {name: 'id_cnh_colisao'}, {name: 'cnh_condutor_colisao'}, {name: 'comprovante_residencia_condutor_colisao'}, {name: 'crlv_carro_colisao'}, {name: 'homologacao_kitgas_colisao'}, {name: 'registro_ocorrencia_colisao'}]);
  app.post('/uploadfilescolisao', cpUploadColisao, async (req, res, next) => { 

    // pegando variaveis de texto
    let nome = req.body.nome_colisao
    let cpf = req.body.cpf_colisao
    let telefone = req.body.telefone_colisao
    let email = req.body.email_colisao
    let local_date_time = req.body.hora_ocorrencia_colisao
    let descricao_ocorrencia = req.body.descricao_ocorrencia_colisao  ? descricao_ocorrencia_colisao  : ""
    let descricao_danos_colisao = req.body.descricao_danos_colisao
    let natureza_do_evento = req.body.natureza_do_evento
    let descricao_acidente_colisao = req.body.descricao_acidente_colisao
  

    // o protocolo é composto pelo timestamp da data corrente + 4 primeiros digitos do cpf
    const char4 = cpf.substring(0,4);
    const protocolo = await currentDate + char4;


    // variável que guarda o nome temporário dos arquivos - A ser utilizado no loop
    let descricao_do_arquivo = ""


    // inserindo associado
    let cpfKey = await cpf.replaceAll(".", "");
    cpfKey = await cpfKey.replaceAll("-", "");
    
    await rtdb.ref('associados/' + cpfKey).set({
        nome,
        telefone,
        email
      }).then(() => { 
        console.log("associado cadastrado");
      });

    let protocoloKey = await protocolo.replace(".", "")
    await rtdb.ref('protocolos/' + protocoloKey).set({
        data: formatedDate,
        associado: cpf,
        documentos,
        terceiros: [],
        dataOcorrencia: local_date_time,
        descricaoOcorrencia: descricao_ocorrencia,
        descricaoDanos: descricao_danos_colisao,
        descricaoAcidente: descricao_acidente_colisao
      }).then(() => { 
        console.log("protocolo cadastrado");
      });
    

    // loop para colocar os documentos no realtime database
    for(let i = 0; i<documentos.length; i++){
      let idObject = protocoloKey + "_" + documentos[i].nome_do_arquivo;

      switch (documentos[i].nome_do_arquivo) {
        case "nome":
          descricao_do_arquivo = "Nome do associado"
          break;
        
        case "cpf": 
          descricao_do_arquivo = "CPF do associado"
          break;

        case "comprovante_residencia": 
          descricao_do_arquivo = "comprovante de residência do associado"
          break;

        case "id_cnh": 
          descricao_do_arquivo = "Identidade ou CNH do associado"
          break;

        case "crv_veiculo": 
          descricao_do_arquivo = "Documento de compra e venda do veículo"
          break;

        case "homologacao_kitgas": 
          descricao_do_arquivo = "Documento de homologação do kitgás"
          break;

        case "registro_ocorrencia": 
          descricao_do_arquivo = "Registro de ocorrência"
          break;

        
        case "cnh_condutor_colisao": 
          descricao_do_arquivo = "CNH do Condutor"
          break;
        
        case "comprovante_residencia_condutor_colisao": 
          descricao_do_arquivo = "Comprovante de residencia do condutor"
          break;

        default:
          descricao_do_arquivo = "documento não identificado"
          break;
      }

      await rtdb.ref('documentos/' + protocoloKey + "_doc" + i).set({
        nome_do_arquivo: documentos[i].nome_do_arquivo,
        extensao: documentos[i].extensao,
        data_insercao: formatedDate,
        descricao_do_arquivo,
        protocolo
      }).then(() => { 
        console.log("documento " + documentos[i].nome_do_arquivo + " cadastrado");
      });
    }

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "mail.gestaogma.com.br",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'no-reply@gestaogma.com.br', 
      pass: '@Gma123456', 
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false,
    },
  });

  //configurando mensagem
  let htmlBody = "Entrada de uma colisão <br /><br /> " + 
    "Nome: " + nome + "<br />" +  
    "CPF: " + cpf + "<br />" + 
    "Natureza do evento: " + natureza_do_evento + "<br />" +
    "Telefone para contato: " + telefone + "<br />" +
    "E-mail para contato: " + email + "<br />" +
    "Data da ocorrência: " + local_date_time + "<br />" + 
    "Descrição do evento: " + descricao_ocorrencia + "<br />" + 
    "descrição das avarias: " + descricao_danos_colisao + "<br />" + 
    "Descrição do acidente: " + descricao_acidente_colisao + ".";


  let mensagem = {
    from: "no-reply@gestaogma.com.br", // sender address
    to: "eventos2@gestaogma.com.br, eventos@gestaogma.com.br, assistenteeventos@gestaogma.com.br",  // list of receivers eventos2@gestaogma.com.br, eventos@gestaogma.com.br, assistenteeventos@gestaogma.com.br
    subject: "Uma nova entrada (colisão) no eventos foi realizada. Protocolo: " + protocolo, // Subject line
    html: htmlBody,
    attachments: documentosToSendInEmail
  }

  // send mail with defined transport object
  await transporter.sendMail(mensagem, 
    function(err){
      if(err){
        console.log(err)
      }else{
        console.log("tudo certo")
      }
    });


    res.redirect('/protocolo?protocolo=' + protocolo )
  });

  // roda responsável por tratar os documentos do terceiro
  const uploadterceiro = multer({storage: storage})
  const cpUploadTerceiro = upload.fields([{name: 'comprovante_residencia_terceiro'}, {name: 'id_cnh_terceiro'}, {name: 'crv_carro_terceiro'}, {name: 'registro_ocorrencia_terceiro'}]);
  app.post('/uploadfilesterceiro', cpUploadTerceiro, async (req, res, next) =>{
    // pegando variaveis de texto
    let nome = req.body.nome_terceiro
    let cpf = req.body.cpf_terceiro
    let telefone = req.body.telefone_terceiro
    let email = req.body.email_terceiro
    let protocolo = req.body.protocolo_terceiro
    let danos_terceiro = req.body.descricao_danos_terceiro
    let descricao_ocorrencia_terceiro = req.body.descricao_ocorrencia_terceiro ? descricao_ocorrencia_terceiro  : ""
    let terceiros_previous = [];

    let previousInfoFromProtocolos = null;

    //pegando os dados armazenados em protocolo para poder atualizar posteriormente
    let protocoloKey = await protocolo.replace(".", "")
    await rtdb.ref("protocolos/" + protocoloKey)
      .get()
      .then(async (snapshot) => {
        if (snapshot.exists()) {
          console.log(snapshot.val());
          previousInfoFromProtocolos = await snapshot.val()
          terceiros_previous = Object.hasOwn(previousInfoFromProtocolos, 'terceiros') ? previousInfoFromProtocolos.terceiros : [];
        } else {
          console.log("No data available");
        }
      }).catch((error) => {
        console.error(error);
      });

    
    // inserindo terceiro
    await rtdb.ref('terceiros/' + cpf.replace(".", "")).set({
      nome,
      telefone,
      email,
      danos_terceiro,
      descricao_ocorrencia_terceiro
    }).then(() => { 
      console.log("terceiro cadastrado");
    });

    await terceiros_previous.push(cpf)

    if(previousInfoFromProtocolos){
      previousInfoFromProtocolos.terceiros = await terceiros_previous
    }else{
      console.log("não é um objeto")
    } 
  
    let updates = {}
    updates['/protocolos/' + protocoloKey + "/terceiros"] = terceiros_previous;

    await rtdb.ref('/').update(updates).then(() => { 
      console.log("terceiro atualizado");
  });

  
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "mail.gestaogma.com.br",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'no-reply@gestaogma.com.br	', 
      pass: '@Gma123456', 
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false,
    },
  });

  //configurando mensagem
  let mensagem = {
    from: "no-reply@gestaogma.com.br", // sender address
    to: "eventos2@gestaogma.com.br, eventos@gestaogma.com.br, assistenteeventos@gestaogma.com.br",  // list of receivers
    subject: "Uma nova entrada (terceiro) no eventos foi realizada. Protocolo: " + protocolo, // Subject line
    html: "Uma nova entrada de terceiro foi realizada <br /><br /> Nome: " + nome + "<br /> CPF: " + cpf + "<br />Telefone para contato: " + telefone + "<br /><br />" + "Descrição dos danos: " + danos_terceiro + "<br /> <br />" + descricao_ocorrencia_terceiro + "", // html body
    attachments: documentosToSendInEmail
  }

  // send mail with defined transport object
  await transporter.sendMail(mensagem, 
    function(err){
      if(err){
        console.log(err)
      }else{
        console.log("tudo certo")
      }
    });


    // final return
    res.redirect('/feedback-terceiro?protocolo=' + protocolo )
    
  })

//rotas de feedback
  //página apresentada após a entrada do roubo ou furto
  app.get('/protocolo', (req, res) => {
    res.sendFile('protocolo.html', {root: __dirname + '/public/'})
  })

  //página apresentada após a entrada do terceiro
  app.get('/feedback-terceiro', (req, res) => {
    res.sendFile('feedback-terceiro.html', {root: __dirname + '/public/'})
  })




// rotas do menu principal 
  app.get('/roubo-ou-furto', (req, res) => {
    res.sendFile('entrada-roubo-furto.html', {root: __dirname + '/public/'})
  })

  app.get('/entrada-de-colisao', (req, res) => {
    res.sendFile('entrada-colisao.html', {root: __dirname + '/public/'})
  })

  app.get('/entrada-de-terceiro', (req, res) => {
    res.sendFile('terceiro.html', {root: __dirname + '/public/'})
  })





// feedbacks
app.listen(process.env.PORT || 3000, () => {
  console.log("Express server listening on port in mode");
})