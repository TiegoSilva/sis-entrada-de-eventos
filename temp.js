
 
 
   await rtdb.ref('protocolos/' + protocolo).update({
    terceiros: [cpf]
  }).then(() => { 
    console.log("terceiro atualizado");
  });

  // variável que guarda o nome temporário dos arquivos - A ser utilizado no loop
  let descricao_do_arquivo = ""

  // colocando os documentos no firebase
  for(let i = 0; i<documentos.length; i++){
    let idObject = protocolo + "_terceiro_" + documentos[i].nome_do_arquivo;

    switch (documentos[i].nome_do_arquivo) {
      case "nome_terceiro":
        descricao_do_arquivo = "Nome do associado"
        break;
      
      case "cpf_terceiro": 
        descricao_do_arquivo = "CPF do associado"
      break;

      case "comprovante_residencia_terceiro": 
        descricao_do_arquivo = "comprovante de residência do associado"
        break;

      case "id_cnh_terceiro": 
        descricao_do_arquivo = "Identidade ou CNH do associado"
        break;

      case "registro_ocorrencia_terceiro": 
        descricao_do_arquivo = "Registro de ocorrência"
        break;

      default:
        descricao_do_arquivo = "documento não identificado"
        break;
    }

    await rtdb.ref('documentos/' + protocolo + "_doc" + i).set({
      nome_do_arquivo: idObject,
      extensao: documentos[i].extensao,
      data_insercao: formatedDate,
      descricao_do_arquivo,
      protocolo
    }).then(() => { 
      console.log("documento " + documentos[i].idObject + " cadastrado");
    });
  }