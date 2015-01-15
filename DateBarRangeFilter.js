{
  id: 'xdo.app.mobile.DateBarRangeFilter',
  component: {
    'name': 'Time Series Bar Chart with filter',
    'tooltip': 'Insert DateRangeFilter with Bar'
  },
  
  /**
   * @type {Array}
   * Default Properties - these can be changed when you drop this plugin in your 
   * BIMAD App at design time.
   */
  properties: [
    {key: "width", label: "Width", type: "length", value: "540px"},
    {key: "height", label: "Height", type: "length", value: "100px"},
    {key: "color", label:"color", type: "color", value:"#31a354"},
  {key: "timeinterval", label:"time interval", type:"lov", value:'year',
      options:[{value:"day", label:"day"},{value:"month",label:"month"},{value:"year",label:"year"}]}
  ],
  
  /**
   * @type {Array}
   * Thirdparty Libraries that you want to use in the plugin
   */
  remoteFiles: [
    // loading js file located on the remote server
    // (also adding the logic to make sure it is loaded)
    {type:'js', location:'http://d3js.org/d3.v3.min.js', isLoaded: function() {
      return (window['d3'] != null);
    }},

    // points to css/mystyle.css under assets folder
    {type:'css', location:'asset://daterange.css'}
  ],
  
  /**
   *@type {Array}
   */
  fields: [
    {name: "UPDATED_DATE", caption: "Drop DATE Field Here", fieldType: "label", dataType: "date"},
    {name: "OPENBUG_COUNT", caption: "Drop NUMBER Field Here", fieldType: "measure", dataType: "number", formula: "summation"}
  ],
  /**
   * @type {String}
   * Supported data type for the plugin
   */
  dataType: 'arrayOfArrays',


  /**
   * @private
   * @param {Date} date1
   * @param {Date} date2
   * @returns {Number} date differences between two dates
   */
  _getDateDiff: function(date1,date2){
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return diffDays;
  },

  /**
   * @private 
   * @param {Date} date
   * @returns {Date} next date
   */
  _getNextDate: function(date){
    //use the constructor to create a date object by milliseconds
    var nextday = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    return nextday;
  },
  
  /**
   * @private
   * @param {String} timeinternval - for now "year", "month" are supported
   * @param {Array} rawdata - array of data
   * @returns {Array} aggregated data array
   */
  _aggregateData: function(timeinterval, rawdata){
    
    // in case of day, no need for aggregation
    if(timeinterval === 'day'){
       return rawdata;  
    }
    
     // prepare a function that generates key for aggregatino
    var _keyfunction = function(d){
      if(timeinterval === "month"){ // key is year + month
        return (d.date.getFullYear().toString()  + d.date.getMonth().toString());
      } else if(timeinterval === "year"){ // key is year
        return (d.date.getFullYear().toString());
      }
    };
    
    // Do aggregation with d3.nest
    var _aggregated = d3.nest()
     .key(_keyfunction)
     .rollup(function(d) { return d3.sum(d, function(e) { return +e.value; }); })
     .entries(rawdata)
     .map(function(d) { return {"date": +d.key, "value": d.values}; });
    
    
    // Re-construct date object for month so that D3 can use it later to render bar chart..
    // for year, use Number type insted of date.
    var aggregatedDateArray = _aggregated.map(function(d,index){
      if(timeinterval === "month"){
         var year = d.date.toString().substring(0,4); // first 4 didgits are for year.
         var month = d.date.toString().substring(4); // rest is the month
         var date = new Date(year, month, 1); // use 1st day of the month
         return {"date": date, "value":d.value};
      } else if (timeinterval === "year"){
         var year = d.date.toString().substring(0,4); // first 4 digits are for year
         var date;
         if(index === _aggregated.length-1){
           date = new Date(year,11,31); // use Dec 31st in case of last itme year aggregation
         } else {
           date = new Date(year,0,1); // use Jan 1st in case of year aggregation
         }
         return {"date": date, "value":d.value};
      }
    });
    
    return aggregatedDateArray;
  },
  
  /**
   * @private
   * API that fills the missing date and value (if no value found for a date, fill with 0)
   *     
   */
  _fillMissingData: function(data){
    var i, len = data.length, dateArray = [], yMinVal=0, yMaxVal=0, count=0;
    for(i=0; i<len; i++){
      var date = new Date(data[i][0]);
      if(!isNaN(date.getTime())) {
        if(i>0){
          var lastDate = dateArray[dateArray.length-1].date;
          var diff = this._getDateDiff(lastDate,date);
          if(diff>1){
            var adjustMent = this._getNextDate(lastDate);
            for(var j=0; j<diff;j++){
              dateArray.push({"date":adjustMent,"value":0});
              count++;
              adjustMent = this._getNextDate(adjustMent);
            }
          }
        }
        dateArray.push({"date":date,"value":data[i][1]});
        count++;
        if(data[i][1]>yMaxVal){
          yMaxVal = data[i][1];
        }
        if(data[i][1]<yMinVal){
          yMinVal = data[i][1]
        }
      }
    }
    return {'filled':dateArray, 'max':yMaxVal, 'min':yMinVal};
  },
  
  /**
   * @public
   * @param {} context
   * @param {HTMLElement} containerElem
   * @param {Array} data
   * @param {} fields
   * @param {Array} props
   */
  render: function (context, containerElem, data, fields, props) {

    var _this = this;
    _this.props = props;
    // clean up previous filter
    _this.filter = null;
    
    var _filterDivId = containerElem.id.replace("content","filter");
    if(_filterDivId.indexOf('_filter')>-1){
      $('#'+_filterDivId).hide();
    }
     // cleanup svg area..
     d3.select(containerElem).selectAll('svg').remove();

    // if no data found, shows no data found message
    if (!data || data.length == 0) {
      containerElem.innerHTML += '<p>No Data Found</p>';
      return;
    }

    // Only array is supported for now..
    if (!(data instanceof Array)) {
      containerElem.innerHTML += '<p>Sorry, this plugin is not compatible with JSON/CSV format.</p>';
      return;
    }

    var basewidth = parseInt(props["width"].replace(/px/,''));
    var baseheight = parseInt(props["height"].replace(/px/,''));

    var margin = {top: 10, right: 20, bottom: 20, left: 10};

    var width = basewidth - margin.right - margin.left;
    var height = baseheight - margin.top - margin.bottom;

    var invalidDate = [], count=0;

    // Since it's time series bar chart, do sorting by date
    data.sort(function(a,b){
        var aDate = new Date(a[0]), bDate = new Date(b[0]);
        return aDate >bDate ? 1: aDate < bDate ?-1: 0
    });
    
    // then fill the missing date and value
    var _filledData = _this._fillMissingData(data);
    var dateArray = _filledData.filled;
    var yMinVal = _filledData.min;
    var yMaxVal = _filledData.max;
    
    // next, do aggregation
    var timeinterval = props["timeinterval"]?props["timeinterval"]:"day";
    var aggregatedDateArray = _this._aggregateData(timeinterval, dateArray);
  
    // if aggregated, re-calculate min/max value
    if(timeinterval !== 'day'){
     aggregatedDateArray.forEach(function(data){
        if(data.value > yMaxVal){
          yMaxVal = data.value;
        }
        if(data.value<yMinVal){
          yMinVal = data.value;
        }
     });
    }
    
    // x scale
    var x = d3.time.scale()
    .domain([aggregatedDateArray[0].date,aggregatedDateArray[aggregatedDateArray.length-1].date])
    .range([0, width]);
    
    var nicefunction = d3.time.day;
    switch(timeinterval){
      case "day":
        x.nice(d3.time.day);
        break
      case "month":
        x.nice(d3.time.month);
        break;
       case "year":
        x.nice(d3.time.year);
        break;
    }
    // y scale
    var y = d3.scale.linear()
    .domain([yMinVal,yMaxVal])
    .range([height,0]);

    // x axis
    var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");
 
    if(timeinterval === 'year'){
      xAxis.tickFormat(d3.time.format('%Y'));
      xAxis.ticks(aggregatedDateArray.length);
    }
    
    // y axis
    var yAxis = d3.svg.axis().scale(y).orient("left");

    // set on brushed event handler
    var brush = d3.svg.brush()
      .x(x)
      .on("brushend", brushended);

    var area = d3.svg.area()
       .interpolate("monotone")
       .x(function(d){return x(d.date) - (width/aggregatedDateArray.length)/2;})
       .y0(height)
       .y1(function(d) {return y(d.value);});

    var svg = d3.select(containerElem).append("svg")
      .data(dateArray)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    svg.append("defs").append("cilpPath")
    .attr("id",  "clip")
    .append("rec")
    .attr("width",width)
    .attr("height",height);

    var context = svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + margin.left + ","+ margin.top + ")");


  var barWidth = width / aggregatedDateArray.length;

  var bar = context.selectAll("g")
      .data(aggregatedDateArray)
    .enter().append("g");
    
  bar.attr("transform", function(d, i) { return "translate(" + (i*barWidth + margin.left) + ",0)"; });

  bar.append("rect")
      .attr('fill', props.color?props.color:_this.properties['color'])
      .attr("y", function(d) { return y(d.value); })
      .attr("height", function(d) { return height - y(d.value); })
      .attr("width", barWidth);
      
  context.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate("+margin.left+", "+height+")")
          .call(xAxis);

  context.append("g")
          .attr("transform", "translate("+margin.left+", 0)")
          .attr("class", "x brush")
          .call(brush)
          .selectAll("rect")
          .attr("y", -6)
          .attr("height", height + 7);

function brushended() {
  //console.log("In Brush..");
  _this._brushCleaned = false;
  var extent0 = brush.extent();
  var extent1 = extent0.map(d3.time.day.round);

  // if empty when rounded, use floor & ceil instead
  if (extent1[0] >= extent1[1]) {
    extent1[0] = d3.time.day.floor(extent0[0]);
    extent1[1] = d3.time.day.ceil(extent0[1]);
  }
  if(_this.minVal === extent1[0].toISOString() && _this.maxVal === extent1[1].toISOString()){
    //console.log("ignoring brush..");
    _this._brushCleaned = false;
    return;//only transition after input
  }
  _this.minVal = extent1[0].toISOString();
  _this.maxVal = extent1[1].toISOString();
  if (_this.isSDK()) {
       //xdo.api.handleClickEvent({id: context.id, filter: filters});
       // no filter at design time may be
  } else {
     if (_this.isViewer()) {
        if (_this.filter) {
          //console.log("In Brushed:Removing old filter..:"+_this.filter.toString());
          xdo._supernastymarker = null;
          xdo.app.viewer.GlobalFilter.removeFilter(containerElem.id, _this.filter.id, true); // compId, filterId, noreload
        }
        xdo.require('xdo.app.viewer.components.mobile.filter.GlobalFilter');
        _this.filter = new xdo.app.viewer.components.mobile.filter.GlobalFilter();
        _this.filter.operator = xdo.app.viewer.components.mobile.filter.GlobalFilter.FILTER_OPERATORS.BETWEEN;
        var fieldPath = fields[0].field;
        _this.filter.fieldPath = fieldPath;
        if(!_this.filter.values){
          _this.filter.values = [];
        }
        _this.filter.values[0] = {"text": _this.minVal, "type": "literal"};
        _this.filter.values[1] = {"text": _this.maxVal, "type": "literal"};
        xdo._supernastymarker = {};
        //console.log("In Brushed: Adding new filter..:"+_this.filter.toString());
        var expression = _this.filter.getExpression(true);
        var formula = new xdo.app.designer.appwidget.formula.Formula();
        formula.setExpression(expression);
        _this.filter.formula = formula;
        
        xdo.app.viewer.GlobalFilter.addFilter({id: containerElem.id.replace("_content",""), filter: [_this.filter]});
    } else {
      //console.log("In designer now. All events are ignored.");
    }

  }

  d3.select(this).transition()
      .call(brush.extent(extent1))
      .call(brush.event);
  }

  },
  // ------------------------------------------------------------
  isSDK : function()  {
    return (xdo.app === undefined);
  },
  // ------------------------------------------------------------
  isViewer : function()  {
    return (xdo.app.designer.DesignerApplication === undefined);
  },
  // ------------------------------------------------------------

  /**
   * @public
   * Refresh event handler
   */
  refresh: function (context, containerElem, data, fields, props) {
    //console.log("begin refresh..");
    if(this.filter && this._brushCleaned){
      //console.log("In Refresh: removing filter..:"+this.filter.toString());
      xdo.app.viewer.GlobalFilter.removeFilter(containerElem.id.replace('_content',''), this.filter.id, false); // compId, filterId, noreload
      this.filter = null;
      return;
    } else if (!this._brushCleaned) {
      //console.log("In refresh: refresh initiated by itself. no refresh...");
      return;
    } else {
     // remove everything. ugly but easy.
     //console.log("In refresh: refresh called.");
     d3.select(containerElem).selectAll('svg').remove();
     this.render(context, containerElem, data, fields, props);
    }
  }

}
