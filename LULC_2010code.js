/**
 * Function to mask clouds based on the pixel_qa band of Landsat SR data.
 * @param {ee.Image} image Input Landsat SR image
 * @return {ee.Image} Cloudmasked Landsat image
 */
 var cloudMaskL457 = function(image) {
    var qa = image.select('pixel_qa');
    // If the cloud bit (5) is set and the cloud confidence (7) is high
    // or the cloud shadow bit is set (3), then it's a bad pixel.
    var cloud = qa.bitwiseAnd(1 << 5)
                    .and(qa.bitwiseAnd(1 << 7))
                    .or(qa.bitwiseAnd(1 << 3));
    // Remove edge pixels that don't occur in all bands
    var mask2 = image.mask().reduce(ee.Reducer.min());
    return image.updateMask(cloud.not()).updateMask(mask2);
  };
  
  
  var dataset = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
                    .filterDate('2010-01-01', '2010-12-31')
                   .map(cloudMaskL457);
                    
  /** to clip the images to the geometry ***/
  
  dataset = dataset.map(function(img){return img.clip(geometry)});
  
  var composite = dataset.median(); 
  
  var visParams = {
    bands: ['B4', 'B3', 'B2'],
    min: 0,
    max: 3000,
    gamma: 1.4,
  };
  Map.setCenter(-86, 33.2513, 8);
  //Map.addLayer(composite, visParams);
  /***
  var huntsville = ee.FeatureCollection("users/MeghaShrestha/huntsmad_dec");
  var auburn = ee.FeatureCollection("users/MeghaShrestha/auburn");
  var birm = ee.FeatureCollection("users/MeghaShrestha/birm_hoover");
  var mobile = ee.FeatureCollection("users/MeghaShrestha/mobile");
  var decatur = ee.FeatureCollection("users/MeghaShrestha/decatur");
  var mont = ee.FeatureCollection("users/MeghaShrestha/mont");
  var tusca = ee.FeatureCollection("users/MeghaShrestha/tusca");
  
   ***/
  
  var water = ee.FeatureCollection("users/MeghaShrestha/water2010");
  var vegetation = ee.FeatureCollection("users/MeghaShrestha/veg2010");
  var urban = ee.FeatureCollection("users/MeghaShrestha/urban2010");
  var barren = ee.FeatureCollection("users/MeghaShrestha/barren2010");
     
  //Map.addLayer(urban, {color: 'red'}, 'Urban Areas');
  //Map.addLayer(vegetation, {color: 'green'}, 'vegetation');
  //Map.addLayer(water, {color: 'blue'}, 'water');
  //Map.addLayer(barren, {color: 'yellow'}, 'barren');
  
  
  var gcps = urban.merge(barren).merge(water).merge(vegetation);
  
  
  var addIndices = function(image) {
    var ndvi = image.normalizedDifference(['B4', 'B3']).rename(['ndvi']);
    var ndbi = image.normalizedDifference(['B5', 'B4']).rename(['ndbi']);
    var mndwi = image.normalizedDifference(['B2', 'B5']).rename(['mndwi']); 
    var bsi = image.expression(
        '(( X + Y ) - (A + B)) /(( X + Y ) + (A + B)) ', {
          'X': image.select('B5'), //swir1
          'Y': image.select('B3'),  //red
          'A': image.select('B4'), // nir
          'B': image.select('B1'), // blue
    }).rename('bsi');
    return image.addBands(ndvi).addBands(ndbi).addBands(mndwi).addBands(bsi)
  }
  
  var composite = addIndices(composite);
  
  
  var visParams = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000, gamma: 1.2};
  
  
  // Normalize the image 
  
  // Machine learning algorithms work best on images when all features have
  // the same range
  
  // Function to Normalize Image
  // Pixel Values should be between 0 and 1
  // Formula is (x - xmin) / (xmax - xmin)
  //************************************************************************** 
  
  function normalize(image){
    var bandNames = image.bandNames();
    // Compute min and max of the image
    var minDict = image.reduceRegion({
      reducer: ee.Reducer.min(),
      geometry: geometry,
      scale: 20,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 16
    });
    var maxDict = image.reduceRegion({
      reducer: ee.Reducer.max(),
      geometry: geometry,
      scale: 20,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 16
    });
    var mins = ee.Image.constant(minDict.values(bandNames));
    var maxs = ee.Image.constant(maxDict.values(bandNames));
  
    var normalized = image.subtract(mins).divide(maxs.subtract(mins))
    return normalized
  }
  
  var composite = normalize(composite);
  // Add a random column and split the GCPs into training and validation set
  var gcp = gcps.randomColumn()
  
  // This being a simpler classification, we take 60% points
  // for validation. Normal recommended ratio is
  // 70% training, 30% validation
  var trainingGcp = gcp.filter(ee.Filter.lt('random', 0.6));
  var validationGcp = gcp.filter(ee.Filter.gte('random', 0.6));
  //Map.addLayer(validationGcp)
  // Overlay the point on the image to get training data.
  var training = composite.sampleRegions({
    collection: trainingGcp,
    properties: ['landcover'],
    scale: 10,
    tileScale: 16
  });
  //print(training)
  // Train a classifier.
  var classifier = ee.Classifier.smileRandomForest(50)
  .train({
    features: training,  
    classProperty: 'landcover',
    inputProperties: composite.bandNames()
  });
  
  // Classify the image.
  var classified = composite.classify(classifier);
  
  var huntsville = ee.FeatureCollection('users/MeghaShrestha/huntsmad_dec');
  huntsville = huntsville.geometry();
  
  var auburn = ee.FeatureCollection('users/MeghaShrestha/auburn');
  auburn = auburn.geometry();
  
  var birm = ee.FeatureCollection('users/MeghaShrestha/birm_hoover');
  birm = birm.geometry();
  
  var decatur = ee.FeatureCollection('users/MeghaShrestha/decatur');
  decatur = decatur.geometry();
  
  var mobile = ee.FeatureCollection('users/MeghaShrestha/mobile');
  mobile = mobile.geometry();
  
  
  var mont = ee.FeatureCollection('users/MeghaShrestha/mont');
  mont = mont.geometry();
  
  var tusca = ee.FeatureCollection('users/MeghaShrestha/tusca');
  tusca = tusca.geometry();
  
  //Map.addLayer(classified, {min: 0, max: 3, palette: ['gray', 'brown', 'blue', 'green']}, '2010');
  
  //************************************************************************** 
  // Accuracy Assessment
  //************************************************************************** 
  
  // Use classification map to assess accuracy using the validation fraction
  // of the overall training set created above.
  /**
  var test = classified.sampleRegions({
    collection: validationGcp,
    properties: ['landcover'],
    scale: 10,
    tileScale: 16
  });
  
  var testConfusionMatrix = test.errorMatrix('landcover', 'classification')
  // Printing of confusion matrix may time out. Alternatively, you can export it as CSV
  print('Confusion Matrix', testConfusionMatrix);
  print('Test Accuracy', testConfusionMatrix.accuracy());
  **/
  //************************************************************************** 
  // Exporting Results
  //************************************************************************** 
  /***
  Export.image.toDrive({
    image: classified,
    description: 'LULC1990',
    folder: 'LULC',
    region: huntsville,
    scale: 30,
    crs: 'EPSG:3395'
  });***/
  
  
  
  
  Export.image.toDrive({
    image: classified,
    description: 'hunt2010',
    folder: 'LULC',
    region: huntsville,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: classified,
    description: 'auburn2010',
    folder: 'LULC',
    region: auburn,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: classified,
    description: 'birm2010',
    folder: 'LULC',
    region: birm,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: classified,
    description: 'dec2010',
    folder: 'LULC',
    region: decatur,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: classified,
    description: 'mob2010',
    folder: 'LULC',
    region: mobile,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: classified,
    description: 'mont2010',
    folder: 'LULC',
    region: mont,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: classified,
    description: 'tusca2010',
    folder: 'LULC',
    region: tusca,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  /***
  Export.image.toDrive({
    image: composite,
    description: 'hunt10',
    folder: 'LULC',
    region: huntsville,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: composite,
    description: 'auburn10',
    folder: 'LULC',
    region: auburn,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: composite,
    description: 'birm10',
    folder: 'LULC',
    region: birm,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: composite,
    description: 'dec10',
    folder: 'LULC',
    region: decatur,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: composite,
    description: 'mob10',
    folder: 'LULC',
    region: mobile,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: composite,
    description: 'mont10',
    folder: 'LULC',
    region: mont,
    scale: 30,
    crs: 'EPSG:3395'
  });
  
  Export.image.toDrive({
    image: composite,
    description: 'tusca10',
    folder: 'LULC',
    region: tusca,
    scale: 30,
    crs: 'EPSG:3395'
  });
  /***
  Export.table.toDrive({
    collection: water,
    description: 'water',
    fileFormat: 'CSV'
  });
  
  Export.table.toDrive({
    collection: vegetation,
    description: 'vegetation',
    fileFormat: 'CSV'
  });
  
  Export.table.toDrive({
    collection: urban,
    description: 'urban',
    fileFormat: 'CSV'
  });
  
  Export.table.toDrive({
    collection: barren,
    description: 'barren',
    fileFormat: 'CSV'
  });***/