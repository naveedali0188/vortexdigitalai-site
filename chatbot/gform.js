window.VX_FORM_ENDPOINT = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";
async function vxSubmitToSheet(data){
  if(!window.VX_FORM_ENDPOINT || window.VX_FORM_ENDPOINT.indexOf("PASTE_") === 0) return false;
  try{
    await fetch(window.VX_FORM_ENDPOINT, {method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain"}, body:JSON.stringify(data)});
    return true;
  }catch(e){ return false; }
}
