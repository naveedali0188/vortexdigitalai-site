function doPost(e){
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var row = [new Date()];
  sheet.getDataRange().getValues()[0] ? null : sheet.appendRow(["Timestamp"].concat(Object.keys(data)));
  row = row.concat(Object.keys(data).map(function(k){return data[k];}));
  sheet.appendRow(row);
  return ContentService.createTextOutput("ok");
}
