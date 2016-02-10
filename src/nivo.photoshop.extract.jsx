#target photoshop
#strict on

/*--------------------- Installation
 *
 * copy extractMe to 'Photoshop/Presets/Scripts'
 *
 *--------------------- VERSION:
 *
 * 1.0
 *
 *--------------------- How to use
 *
 * every asset that should be exported as a PNG-File must be placed
 * in a group with one leading "#" in its name. The script will then
 * iterate through all groups and saves all assets to an assetsfolder
 * in the same directory the current psd was saved.
 *
 * Result:
 * PNG24, RGB, Trimmed whitespace, no background
 *
 *--------------------- Author
 *
 * 2015 Nils Vogt
 *
 *--------------------- Resources
 *
 * Photoshop CC JavaScript Reference (PDF, 1.9 MB):
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/photoshop/pdfs/photoshop_scriptref_js.pdf
 *
 */

(function(){

  /**
   * ExtractMe
   * init
   *  handleLayerSets
   *    handleLayerSet
   *      updateProgress
   *    handleLayerSets (recursion)
   *  showResult
   */
  var ExtractMe = (function(){

    var DIRECTORY_SEPARATOR = "/";
    var loopCounter = 0; // counting the inspected groups
    var assetIndex = 0; // counting the extraced assets
    var originalFile, originalDocument, originalFilePath;
    var time_start;
    var progressWindow;
    var totalLayerSets = 0;
    var optionsSave = new ExportOptionsSaveForWeb();

    var currentLayerset;
    optionsSave.format = SaveDocumentType.PNG;
    optionsSave.PNG8 = false; // setting PNG8 to false so we save a PNG24
    optionsSave.transparency = true;

    function init(){
      originalDocument = app.activeDocument;
      originalFile = new File(decodeURI(originalDocument.fullName.fsName));
      originalFilePath = originalDocument.path + DIRECTORY_SEPARATOR + 'assets';

      // Stop if file is not saved yet
      if( !originalDocument.saved ){
        alert('You need to save your psd first!');
        return;
      }

      // Save the current preferences
      var startRulerUnits = app.preferences.rulerUnits;
      var startTypeUnits = app.preferences.typeUnits;
      var startDisplayDialogs = app.displayDialogs;

      // Set Adobe Photoshop CC 2014 to use pixels and display no dialogs
      app.preferences.rulerUnits = Units.PIXELS;
      app.preferences.typeUnits = TypeUnits.PIXELS;
      app.displayDialogs = DialogModes.NO;

      time_start = Date.now();

      // Create progress window
      // progressWindow = new Window("palette{text:'Please be patient...',bounds:[100,100,580,40]," + "bar:Progressbar{bounds:[20,20,60,30] , minvalue:0,value:" + 10 + "}};" );
      progressWindow = new Window("palette{text:'Please be patient...',bounds:[100,100,580,220]," + "bar:Progressbar{bounds:[20,50,460,70] , minvalue:0,value:" + 10 + "}};" );

      progressWindow.labelCurrentLayerName = progressWindow.add ('statictext {text: "No break: ",bounds:[20,20,460,50]}');
      progressWindow.labelCurrentLayerName.graphics.foregroundColor = progressWindow.labelCurrentLayerName.graphics.newPen (progressWindow.graphics.PenType.SOLID_COLOR, [0.7, 0.7, 0.7], 1);

      progressWindow.labelAutor = progressWindow.add ('statictext {text: "nilsvogt.com",bounds:[370,85,460,50]}');
      progressWindow.labelAutor.graphics.foregroundColor = progressWindow.labelCurrentLayerName.graphics.newPen (progressWindow.graphics.PenType.SOLID_COLOR, [0, 180/255, 240/255], 1);

      progressWindow.graphics.backgroundColor = progressWindow.graphics.newBrush(progressWindow.graphics.BrushType.SOLID_COLOR, [70/255, 70/255, 70/255, 1]);
      progressWindow.bar.maxvalue = 100;
      progressWindow.bar.value = 0;

      progressWindow.center();
      progressWindow.show();

      // create an assets folder if not already exists
      var assetsFolder = Folder(originalFilePath);
      if(!assetsFolder.exists){
        assetsFolder.create();
      }

      // Find layerSets we want to export
      handleLayerSets(app.activeDocument.layerSets);

      // Reset the application preferences
      app.preferences.rulerUnits = startRulerUnits;
      app.preferences.typeUnits = startTypeUnits;
      app.displayDialogs = startDisplayDialogs;

      // Once it is done show an appropriate info
      showResult();
    }

    /**
     * loops recursivly loops through a layerSet
     * and calls handleLayerSet for each layerSet
     */
    function handleLayerSets(layerSets){

      var layerSetsLength = layerSets.length; // layerSets.length is an expensive property

      totalLayerSets += layerSetsLength;

      for (var i = 0; i < layerSetsLength; i++) {
        loopCounter++;

        currentLayerset = layerSets[i]; // This is the most expensive line in this script

        app.activeDocument.activeLayer = currentLayerset;

        var exported = handleLayerSet(currentLayerset);

        /*
         * if group was exported we do not go deeper
         */
        if(!exported){
          // Recursion
          handleLayerSets(currentLayerset.layerSets);
        }
      }
    }

    /**
     * duplicates all layerSets with a leading '#'
     * into a new document so user can save an asset
     * @return bool didExport
     */
    function handleLayerSet(layerSet){

      updateProgress();

      // Skip layerSet if its name does not start with a leading '#'
      if( ! layerSet.name.match(/^#[^#]/)) return false;

      assetIndex++;

      // Get the frame of our layerSet
      var frame = {
        x: layerSet.bounds[0],
        y: layerSet.bounds[1],
        width: layerSet.bounds[2]-layerSet.bounds[0],
        height: layerSet.bounds[3]-layerSet.bounds[1]
      };

      // Create a new document and duplicate current layerSet in it
      var tmpDocument = app.documents.add(frame.width, frame.height, originalDocument.resolution);
      app.activeDocument = originalDocument; // you only can duplicate a layerSet from the current activeDocument
      layerSet.duplicate(tmpDocument, ElementPlacement.INSIDE);

      // Bring tmpDocument to front
      app.activeDocument = tmpDocument;
      tmpDocument.layerSets[0].translate(-frame.x, -frame.y); // reset origin to (0|0)
      tmpDocument.artLayers[0].visible = false;

      // sanitize layername
      var layername = layerSet.name.replace(/[^0-9a-z-_]/ig, '');
      var assetFileSystemPath = originalFilePath + DIRECTORY_SEPARATOR + 'asset-' + assetIndex + '-' + layername +'.png';
      var assetFile = new File(assetFileSystemPath);
      app.activeDocument.trim(TrimType.TRANSPARENT, true, true, true, true);

      app.activeDocument.exportDocument(assetFile, ExportType.SAVEFORWEB, optionsSave);
      app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);

      // Bring back original document
      app.activeDocument = originalDocument;

      return true;
    }

    /**
     * called when script did finish to present
     * the result to the user
     */
    function showResult(){
      progressWindow.close();
      var time_end = Date.now();
      var time_total = (time_end - time_start) / 1000;
      alert("Did save " + assetIndex + ' from ' + loopCounter + ' groups in ' + Math.round(time_total) + ' seconds.');
    }

    /**
     * updates the progressbar and the title of the
     * dialog
     */
    function updateProgress(){
      progressWindow.labelCurrentLayerName.text = 'Processing group: ' + currentLayerset.name;
      progressWindow.text = 'processing '+ loopCounter +" of "+ totalLayerSets +" layer groups. Yet extracted "+ assetIndex +" asset(s).";
      progressWindow.bar.value = loopCounter/totalLayerSets*100;
      progressWindow.center();
      progressWindow.update();
      app.refresh();
    }

    return {init: init};
  }());

  ExtractMe.init();

}());
