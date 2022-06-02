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


// GET METHOD
app.get('/', (req, res) => {
  res.send('index')
  
});

// managing storage 
let diretorio = __dirname + '/uploads/';
const currentDate = Date.now();
const formatedDate = new Date()

let documentos = [];

let storage = multer.diskStorage(
  {
    destination: function (req, file, cb) {
      cb(null, diretorio)
    },
    filename: function (req, file, cb) {
      let filename_l = "";

      let extensao = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);

      filename_l = file.fieldname + "_" + "doc_" + currentDate + extensao;
      documentos.push({nome_do_arquivo: filename_l, extensao, data_de_insercao: formatedDate});

      cb(null, filename_l)
    }
  }
)


const upload = multer({storage: storage})
const cpUpload = upload.fields([{name: 'comprovante_residencia'}, {name: 'id_cnh'}, {name: 'cnh_condutor'}, {name: 'comprovante_residencia_condutor'}, {name: 'crv_carro'}, {name: 'homologacao_kitgas'}, {name: 'registro_ocorrencia'}]);
app.post('/uploadfiles', cpUpload, async (req, res, next) => { 

  // pegando variaveis de texto
  let nome = req.body.nome
  let cpf = req.body.cpf
 

  // o protocolo é composto pelo timestamp da data corrente + 4 primeiros digitos do cpf
  const char4 = cpf.substring(0,4);
  const protocolo = currentDate + char4;


  // variável que guarda o nome temporário dos arquivos - A ser utilizado no loop
  let descricao_do_arquivo = ""


  // inserindo associado
  await rtdb.ref('associados/' + cpf).set({
      nome
    }).then(() => { 
      console.log("associado cadastrado");
    });


  await rtdb.ref('protocolos/' + protocolo).set({
      data: formatedDate,
      associado: cpf,
      documentos,
      terceiros: []
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

    await rtdb.ref('documentos/' + protocolo + "_doc" + i).set({
      nome_do_arquivo: documentos[i].nome_do_arquivo,
      extensao: documentos[i].extensao,
      data_insercao: formatedDate,
      descricao_do_arquivo,
      protocolo
    }).then(() => { 
      console.log("documento " + documentos[i].nome_do_arquivo + " cadastrado");
    });
  }

  res.redirect('/protocolo?protocolo=' + protocolo )
});

const uploadterceiro = multer({storage: storage})
const cpUploadTerceiro = upload.fields([{name: 'comprovante_residencia_terceiro'}, {name: 'id_cnh_terceiro'}, {name: 'crv_carro_terceiro'}, {name: 'registro_ocorrencia_terceiro'}]);
app.post('/uploadfilesterceiro', cpUploadTerceiro, async (req, res, next) =>{
  // pegando variaveis de texto
  let nome = req.body.nome_terceiro
  let cpf = req.body.cpf_terceiro
  let protocolo = req.body.protocolo_terceiro
  let terceiros_previous = [];

  let previousInfoFromProtocolos = null;

  //pegando os dados armazenados em protocolo para poder atualizar posteriormente
  await rtdb.ref("protocolos/" + protocolo)
    .get()
    .then(async (snapshot) => {
      if (snapshot.exists()) {
        console.log(snapshot.val());
        previousInfoFromProtocolos = await snapshot.val()
        terceiros_previous = Object.hasOwn(previousInfoFromProtocolos, 'terceiros') ? [previousInfoFromProtocolos.terceiros] : [];
      } else {
        console.log("No data available");
      }
    }).catch((error) => {
      console.error(error);
    });

  
  // inserindo associado
  await rtdb.ref('terceiros/' + cpf).set({
    nome
  }).then(() => { 
    console.log("terceiro cadastrado");
  });

  await terceiros_previous.push(cpf)


  if(previousInfoFromProtocolos){
    previousInfoFromProtocolos.terceiros = await terceiros_previous
  }else{
    console.log("não é um objeto")
  }
 
 
  await rtdb.ref('protocolos/' + protocolo).update({
    "terceiros": terceiros_previous|
  }).then(() => { 
    console.log("terceiro atualizado");
  });

 

  // final return
  res.json({
    "message": "pelo menos chegou no envio do formulário :'("
  })
  
})

app.get('/protocolo', (req, res) => {
  res.sendFile('protocolo.html', {root: __dirname + '/public/'})
})


// rotas do menu principal 
app.get('/roubo-ou-furto', (req, res) => {
  res.sendFile('entrada-roubo-furto.html', {root: __dirname + '/public/'})
})

// rotas do menu principal 
app.get('/entrada-de-terceiro', (req, res) => {
  res.sendFile('terceiro.html', {root: __dirname + '/public/'})
})

// feedbacks
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
})