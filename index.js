const express = require('express');
const app = express();
const port = 3000;


const multer = require('multer');


// to permit requests from client side
app.use(express.json());


//to use files from public folder
app.use(express.static('public'));


// GET METHOD
app.get('/', (req, res) => {
  res.send('index')
});


// managing storage 
let diretorio = __dirname + '/uploads/';
console.log(diretorio);

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, diretorio)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = "doc_" + Date.now() + file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);;
    cb(null, file.fieldname + '_' + uniqueSuffix)
  }
})


const upload = multer({storage: storage})


app.post('/emailwithnode', upload.single('tiegodoc'), async (req, res, next) => { 
    
    res.json({
      "all right": "true", 
      "code": 502
    })
})




// feedbacks
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})