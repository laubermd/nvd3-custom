nv.models.multiBarChart = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var multibar = nv.models.multiBar()
        , multibar2 = nv.models.multiBar()
        , xAxis = nv.models.axis()
        , x2Axis = nv.models.axis()
        , yAxis = nv.models.axis()
        , y2Axis = nv.models.axis()
        , interactiveLayer = nv.interactiveGuideline()
        , legend = nv.models.legend()
        , controls = nv.models.legend()
        , brush = d3.svg.brush()
        , tooltip = nv.models.tooltip()
        ;

    var margin = {top: 30, right: 20, bottom: 250, left: 60}
        , margin2 = {top: 0, right: 20, bottom: 20, left: 60}
        , marginTop = null
        , width = null
        , height = null
        , getX = function(d) { return d.x }
        , getY = function(d) { return d.y }
        , color = nv.utils.defaultColor()
        , showControls = true
        , controlLabels = {}
        , showLegend = true
        , legendPosition = null
        , focusEnable = true
        , focusShowAxisY = false
        , focusShowAxisX = true
        , focusHeight = 50
        , showXAxis = true
        , showYAxis = true
        , stacked = false
        , rightAlignYAxis = false
        , reduceXTicks = true // if false a tick will show for every data point
        , staggerLabels = false
        , wrapLabels = false
        , rotateLabels = 0
        , extent
        , brushExtent = null
        , brushScaled = false
        , x //can be accessed via chart.xScale()
        , x2
        , y //can be accessed via chart.yScale()
        , y2
        , state = nv.utils.state()
        , defaultState = null
        , noData = null
        , dispatch = d3.dispatch('brush', 'stateChange', 'changeState', 'renderEnd')
        , transitionDuration = 0
        , controlWidth = function() { return showControls ? 180 : 0 }
        , duration = 250
        , useInteractiveGuideline = false
        ;

    state.stacked = false // DEPRECATED Maintained for backward compatibility
    multibar.stacked(false);
    multibar2.stacked(false);

    xAxis
        .orient('bottom')
        .tickPadding(7)
        .showMaxMin(false)
        .tickFormat(function(d) { return d })
    ;
    yAxis
        .orient((rightAlignYAxis) ? 'right' : 'left')
        .tickFormat(d3.format(',.1f'))
    ;

    x2Axis
        .orient('bottom')
        .tickPadding(5)
        .showMaxMin(false);
    y2Axis.orient('left');

    tooltip
        .duration(0)
        .valueFormatter(function(d, i) {
            return yAxis.tickFormat()(d, i);
        })
        .headerFormatter(function(d, i) {
            return xAxis.tickFormat()(d, i);
        });

    interactiveLayer.tooltip
        .valueFormatter(function(d, i) {
            return d == null ? "N/A" : yAxis.tickFormat()(d, i);
        })
        .headerFormatter(function(d, i) {
            return xAxis.tickFormat()(d, i);
        });

    interactiveLayer.tooltip
        .valueFormatter(function (d, i) {
            return d == null ? "N/A" : yAxis.tickFormat()(d, i);
        })
        .headerFormatter(function (d, i) {
            return xAxis.tickFormat()(d, i);
        });

    interactiveLayer.tooltip
        .duration(0)
        .valueFormatter(function(d, i) {
            return yAxis.tickFormat()(d, i);
        })
        .headerFormatter(function(d, i) {
            return xAxis.tickFormat()(d, i);
        });

    controls.updateState(false);

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch);
    //var stacked = false;

    var getBarsAxis = function() {
        return { main: yAxis, focus: y2Axis };
    }

    var stateGetter = function(data) {
        return function(){
            return {
                active: data.map(function(d) { return !d.disabled }),
                stacked: stacked
            };
        }
    };

    var stateSetter = function(data) {
        return function(state) {
            if (state.stacked !== undefined)
                stacked = state.stacked;
            if (state.active !== undefined)
                data.forEach(function(series,i) {
                    series.disabled = !state.active[i];
                });
        }
    };

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(multibar);
        renderWatch.models(multibar2);
        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(yAxis);

        selection.each(function(data) {
            var container = d3.select(this),
                that = this;
            nv.utils.initSVG(container);
            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight1 = nv.utils.availableHeight(height, container, margin)
                    - (focusEnable ? focusHeight : 0),
                availableHeight2 = focusHeight - margin2.top - margin2.bottom;;

            chart.update = function() {
                if (duration === 0)
                    container.call(chart);
                else
                    container.transition()
                        .duration(duration)
                        .call(chart);
            };
            chart.container = this;

            state
                .setter(stateSetter(data), chart.update)
                .getter(stateGetter(data))
                .update();

            // DEPRECATED set state.disableddisabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            // Display noData message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                nv.utils.noData(chart, container)
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            x = multibar.xScale();
            y = multibar.yScale();
            x2 = multibar2.xScale();
            y2 = multibar2.yScale();

            var focusColumnWidth = x2.domain().length > 0 ? availableWidth / x2.domain().length : 1;
            var scaledBrushExtent = [brushExtent[0]*focusColumnWidth,brushExtent[1]*focusColumnWidth];

            if (!brushScaled && focusColumnWidth > 1) {
                brushScaled = true;
                brushExtent = scaledBrushExtent;
            }

            var series = data
                //.filter(function(d) { return !d.disabled && (d.bar) })
                .map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d,i), y: getY(d,i) }
                    })
                });

            x.range([0, availableWidth]);
            x2.range([0, availableWidth]);
            var xDomainMin = d3.min(data[0].values, function(d) { return d.x; });
            var xDomainMax = d3.max(data[0].values, function(d) { return d.x; });

            if(isNaN(xDomainMin)){
                focusEnable = false;
            }

            if(focusEnable){
                x.domain([
                    xDomainMin,
                    xDomainMax
                ]);
                x2.domain(x.domain());
            }

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-multiBarWithLegend').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-multiBarWithLegend').append('g');
            var g = wrap.select('g');

            var focusEnter = gEnter.append('g').attr('class', 'nv-focus');
            focusEnter.append('g').attr('class', 'nv-x nv-axis');
            focusEnter.append('g').attr('class', 'nv-y nv-axis');
            focusEnter.append('g').attr('class', 'nv-barsWrap');
            focusEnter.append('g').attr('class', 'nv-legendWrap');
            focusEnter.append('g').attr('class', 'nv-controlsWrap');
            focusEnter.append('g').attr('class', 'nv-interactive');

            var contextEnter = gEnter.append('g').attr('class', 'nv-context');
            contextEnter.append('g').attr('class', 'nv-x nv-axis');
            contextEnter.append('g').attr('class', 'nv-y nv-axis');
            contextEnter.append('g').attr('class', 'nv-barsWrap');
            contextEnter.append('g').attr('class', 'nv-brushBackground');
            contextEnter.append('g').attr('class', 'nv-x nv-brush');

            // Legend
            if (!showLegend) {
                g.select('.nv-legendWrap').selectAll('*').remove();
            } else {
                if (legendPosition === 'bottom') {
                    legend.width(availableWidth - margin.right);

                     g.select('.nv-legendWrap')
                         .datum(data)
                         .call(legend);

                     margin.bottom = xAxis.height() + legend.height();
                     availableHeight1 = nv.utils.availableHeight(height, container, margin);
                     g.select('.nv-legendWrap')
                         .attr('transform', 'translate(0,' + (availableHeight1 + xAxis.height())  +')');
                } else {
                    legend.width(availableWidth - controlWidth());

                    g.select('.nv-legendWrap')
                        .datum(data)
                        .call(legend);

                    if (!marginTop && legend.height() !== margin.top) {
                        margin.top = legend.height();
                        availableHeight1 = nv.utils.availableHeight(height, container, margin) - focusHeight;
                    }

                    g.select('.nv-legendWrap')
                        .attr('transform', 'translate(' + controlWidth() + ',' + (-margin.top) +')');
                }
            }

            multibar2.stacked(multibar.stacked());

            // Controls
            if (!showControls) {
                 g.select('.nv-controlsWrap').selectAll('*').remove();
            } else {
                var controlsData = [
                    { key: controlLabels.grouped || 'Grouped', disabled: multibar.stacked() },
                    { key: controlLabels.stacked || 'Stacked', disabled: !multibar.stacked() }
                ];

                controls.width(controlWidth()).color(['#444', '#444', '#444']);
                g.select('.nv-controlsWrap')
                    .datum(controlsData)
                    .attr('transform', 'translate(0,' + (-margin.top) +')')
                    .call(controls);
            }

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
            if (rightAlignYAxis) {
                g.select(".nv-y.nv-axis")
                    .attr("transform", "translate(" + availableWidth + ",0)");
            }

            // Main Chart Component(s)
            multibar
                .disabled(data.map(function(series) { return series.disabled }))
                .width(availableWidth)
                .height(availableHeight1)
                .color(data.map(function(d,i) {
                    return d.color || color(d, i);
                }).filter(function(d,i) { return !data[i].disabled }));

            // hide or show the focus context chart
            g.select('.nv-context').style('display', focusEnable ? 'initial' : 'none');

            multibar2.disabled(data.map(function(series) { return series.disabled }))
                .width(availableWidth)
                .height(availableHeight2)
                .color(data.map(function(d,i) {
                    return d.color || color(d, i);
                }).filter(function(d,i) { return !data[i].disabled }));

            var barsWrap = g.select('.nv-barsWrap')
                .datum(data.filter(function(d) { return !d.disabled }));
            barsWrap.call(multibar);
            // Context component
            g.select('.nv-context')
                .attr('transform', 'translate(0,' + ( availableHeight1 + margin.bottom + margin2.top) + ')')

            var contextBarsWrap = g.select('.nv-context .nv-barsWrap')
                .datum(data.filter(function(d) { return !d.disabled }))
            contextBarsWrap.call(multibar2);

            function setupAxis() {
                // Setup Axes
                if (showXAxis) {
                    xAxis
                        .scale(x)
                        ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                        .tickSize(-availableHeight1, 0);

                    g.select('.nv-x.nv-axis')
                        .attr('transform', 'translate(0,' + y.range()[0] + ')');
                    g.select('.nv-x.nv-axis')
                        .call(xAxis);

                    var xTicks = g.select('.nv-x.nv-axis > g').selectAll('g');

                    xTicks
                        .selectAll('line, text')
                        .style('opacity', 1)
                    if (staggerLabels) {
                        var getTranslate = function(x,y) {
                            return "translate(" + x + "," + y + ")";
                        };

                        var staggerUp = 5, staggerDown = 17;  //pixels to stagger by
                        // Issue #140
                        xTicks
                            .selectAll("text")
                            .attr('transform', function(d,i,j) {
                                return  getTranslate(0, (j % 2 == 0 ? staggerUp : staggerDown));
                            });

                        var totalInBetweenTicks = d3.selectAll(".nv-x.nv-axis .nv-wrap g g text")[0].length;
                        g.selectAll(".nv-x.nv-axis .nv-axisMaxMin text")
                            .attr("transform", function(d,i) {
                                return getTranslate(0, (i === 0 || totalInBetweenTicks % 2 !== 0) ? staggerDown : staggerUp);
                            });
                    }
                    if (wrapLabels) {
                        g.selectAll('.tick text')
                            .call(nv.utils.wrapTicks, chart.xAxis.rangeBand())
                    }
                    if (reduceXTicks)
                        xTicks
                            .filter(function(d,i) {
                                return i % Math.ceil(data[0].values.length / (availableWidth / 100)) !== 0;
                            })
                            .selectAll('text, line')
                            .style('opacity', 0);
                    if(rotateLabels)
                        xTicks
                            .selectAll('.tick text')
                            .attr('transform', 'rotate(' + rotateLabels + ' 0,0)')
                            .style('text-anchor', rotateLabels > 0 ? 'start' : 'end');

                    g.select('.nv-x.nv-axis').selectAll('g.nv-axisMaxMin text')
                        .style('opacity', 1);
                }

                if (showYAxis) {
                    yAxis
                        .scale(y)
                        ._ticks( nv.utils.calcTicksY(availableHeight1/36, data) )
                        .tickSize( -availableWidth, 0);

                    g.select('.nv-y.nv-axis')
                        .call(yAxis);
                }

                // context (focus chart) axis controls
                if (focusShowAxisX) {
                    x2Axis
                        .scale(x2)
                        .ticks(nv.utils.calcTicksX((availableWidth)/100, data))
                        .tickSize(-availableHeight2, 0);

                    g.select('.nv-context .nv-x.nv-axis')
                        .attr('transform', 'translate(0,' + y2.range()[0] + ')');
                    g.select('.nv-context .nv-x.nv-axis').transition()
                        .call(x2Axis);

                    var x2Ticks = g.select('.nv-context .nv-x.nv-axis > g').selectAll('g');

                    if (reduceXTicks)
                        x2Ticks
                            .filter(function(d,i) {
                                return i % Math.ceil(data[0].values.length / (availableWidth / 100)) !== 0;
                            })
                            .selectAll('text, line')
                            .style('opacity', 0);
                    g.select('.nv-context .nv-x.nv-axis').selectAll('g.nv-axisMaxMin text')
                        .style('opacity', 1);
                }
                if (focusShowAxisY) {
                    y2Axis
                        .scale(y2)
                        .ticks(availableHeight2 / 36)
                        .tickSize(-availableWidth, 0);
                    d3.transition(g.select('.nv-context .nv-y.nv-axis'))
                        .call(y2Axis);
                    g.select('.nv-context .nv-x.nv-axis')
                        .attr('transform', 'translate(0,' + x2.range()[0] + ')');
                    g.select('.nv-context .nv-y2.nv-axis').transition()
                        .call(y2Axis);
                }
            }

            setupAxis();

            // Setup Brush
            brush.x(x2).on('brush', onBrush);

            if (brushExtent) brush.extent(brushExtent);

            var brushBG = g.select('.nv-brushBackground').selectAll('g')
                .data([brushExtent || brush.extent()]);

            var brushBGenter = brushBG.enter()
                .append('g');

            brushBGenter.append('rect')
                .attr('class', 'left')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', availableHeight2);

            brushBGenter.append('rect')
                .attr('class', 'right')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', availableHeight2);

            var gBrush = g.select('.nv-x.nv-brush')
                .call(brush);
            gBrush.selectAll('rect')
                //.attr('y', -5)
                .attr('height', availableHeight2);
            gBrush.selectAll('.resize').append('path').attr('d', resizePath);


            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            legend.dispatch.on('stateChange', function(newState) {
                for (var key in newState)
                    state[key] = newState[key];
                dispatch.stateChange(state);
                chart.update();
            });

            controls.dispatch.on('legendClick', function(d,i) {
                if (!d.disabled) return;
                controlsData = controlsData.map(function(s) {
                    s.disabled = true;
                    return s;
                });
                d.disabled = false;
                switch (d.key) {
                    case 'Grouped':
                    case controlLabels.grouped:
                        multibar.stacked(false);
                        multibar2.stacked(false);
                        break;
                    case 'Stacked':
                    case controlLabels.stacked:
                        multibar.stacked(true);
                        multibar2.stacked(true);
                        break;
                }

                state.stacked = multibar.stacked();
                dispatch.stateChange(state);
                chart.update();
            });

            // Update chart from a state object passed to event handler
            dispatch.on('changeState', function(e) {
                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function(series,i) {
                        series.disabled = e.disabled[i];
                    });
                    state.disabled = e.disabled;
                }
                if (typeof e.stacked !== 'undefined') {
                    multibar.stacked(e.stacked);
                    multibar2.stacked(e.stacked);
                    state.stacked = e.stacked;
                    stacked = e.stacked;
                }
                chart.update();
            });


            //Set up interactive layer
            if (useInteractiveGuideline) {
                interactiveLayer
                    .width(availableWidth)
                    .height(availableHeight1)
                    .margin({left:margin.left, top:margin.top})
                    .svgContainer(container)
                    .xScale(x);
                wrap.select(".nv-interactive").call(interactiveLayer);

                interactiveLayer.dispatch.on('elementMousemove', function(e) {
                    if (e.pointXValue == undefined) return;

                    var singlePoint, pointIndex, pointXLocation, xValue, allData = [];
                    data
                        .filter(function(series, i) {
                            series.seriesIndex = i;
                            return !series.disabled;
                        })
                        .forEach(function(series,i) {
                            var offset = brushExtent ? Math.floor(brushExtent[0]/focusColumnWidth) : 0;
                            pointIndex = x.domain().indexOf(e.pointXValue) + offset;
                            var point = series.values[pointIndex];
                            if (point === undefined) return;

                            xValue = point.x;
                            if (singlePoint === undefined) singlePoint = point;
                            if (pointXLocation === undefined) pointXLocation = e.mouseX
                            allData.push({
                                key: series.key,
                                value: chart.y()(point, pointIndex),
                                color: color(series,series.seriesIndex),
                                data: series.values[pointIndex]
                            });
                        });

                    interactiveLayer.tooltip
                        .data({
                            value: xValue,
                            index: pointIndex,
                            series: allData
                        })();

                    interactiveLayer.renderGuideLine(pointXLocation);
                });

                interactiveLayer.dispatch.on("elementMouseout",function(e) {
                    interactiveLayer.tooltip.hidden(true);
                });
            }
            else {
                multibar.dispatch.on('elementMouseover.tooltip', function(evt) {
                    evt.value = chart.x()(evt.data);
                    evt['series'] = {
                        key: evt.data.key,
                        value: chart.y()(evt.data),
                        color: evt.color
                    };
                    tooltip.data(evt).hidden(false);
                });

                multibar.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true);
                });

                multibar.dispatch.on('elementMousemove.tooltip', function(evt) {
                    tooltip();
                });
            }

            // Taken from crossfilter (http://square.github.com/crossfilter/)
            function resizePath(d) {
                var e = +(d == 'e'),
                    x = e ? 1 : -1,
                    y = availableHeight2 / 3;
                return 'M' + (.5 * x) + ',' + y
                    + 'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6)
                    + 'V' + (2 * y - 6)
                    + 'A6,6 0 0 ' + e + ' ' + (.5 * x) + ',' + (2 * y)
                    + 'Z'
                    + 'M' + (2.5 * x) + ',' + (y + 8)
                    + 'V' + (2 * y - 8)
                    + 'M' + (4.5 * x) + ',' + (y + 8)
                    + 'V' + (2 * y - 8);
            }

            function updateBrushBG() {
                if (!brush.empty()) brush.extent(brushExtent);
                brushBG
                    .data([brush.empty() ? [0, availableWidth] : brushExtent])
                    .each(function(d,i) {
                        var leftWidth = d[0],
                            rightWidth = availableWidth - d[1];
                        d3.select(this).select('.left')
                            .attr('width',  leftWidth < 0 ? 0 : leftWidth);

                        d3.select(this).select('.right')
                            .attr('x', d[1])
                            .attr('width', rightWidth < 0 ? 0 : rightWidth);
                    });
            }


            function onBrush() {
                brushExtent = brush.empty() ? null : brush.extent();
                var extent = brush.empty() ? [0, availableWidth] : brush.extent();
                dispatch.brush({extent: extent, brush: brush});
                updateBrushBG();

                var focusBarsWrap = g.select('.nv-focus .nv-barsWrap')
                    .datum(
                    data
                        .filter(function(d) { return !d.disabled })
                        .map(function(d,i) {
                            return {
                                key: d.key,
                                area: d.area,
                                values: d.values.filter(function(d,i) {
                                    return multibar.x()(d,i) >= Math.floor(extent[0]/focusColumnWidth) && multibar.x()(d,i) <= Math.floor(extent[1]/focusColumnWidth);
                                })
                            }
                        })
                );

                focusBarsWrap.transition().duration(transitionDuration).call(multibar);
                setupAxis();

                g.select('.nv-focus .nv-x.nv-axis')
                    .call(xAxis);
                g.select('.nv-focus .nv-y.nv-axis').transition().duration(duration)
                    .call(yAxis);
            }

            onBrush();
        });

        renderWatch.renderEnd('multibarchart immediate');

        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.multibar = multibar;
    chart.multibar2 = multibar2;
    chart.legend = legend;
    chart.controls = controls;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.x2Axis = x2Axis;
    chart.y2Axis = y2Axis;
    chart.state = state;
    chart.tooltip = tooltip;
    chart.interactiveLayer = interactiveLayer;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        legendPosition: {get: function(){return legendPosition;}, set: function(_){legendPosition=_;}},
        showControls: {get: function(){return showControls;}, set: function(_){showControls=_;}},
        brushExtent:    {get: function(){return brushExtent;}, set: function(_){brushExtent=_;}},
        controlLabels: {get: function(){return controlLabels;}, set: function(_){controlLabels=_;}},
        showXAxis:      {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis:    {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        reduceXTicks:    {get: function(){return reduceXTicks;}, set: function(_){reduceXTicks=_;}},
        rotateLabels:    {get: function(){return rotateLabels;}, set: function(_){rotateLabels=_;}},
        staggerLabels:    {get: function(){return staggerLabels;}, set: function(_){staggerLabels=_;}},
        wrapLabels:   {get: function(){return wrapLabels;}, set: function(_){wrapLabels=!!_;}},
        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            if (_.top !== undefined) {
                margin.top = _.top;
                marginTop = _.top;
            }
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            multibar.duration(duration);
            multibar2.duration(duration);
            xAxis.duration(duration);
            yAxis.duration(duration);
            renderWatch.reset(duration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            legend.color(color);
        }},
        rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
            rightAlignYAxis = _;
            yAxis.orient( rightAlignYAxis ? 'right' : 'left');
        }},
        useInteractiveGuideline: {get: function(){return useInteractiveGuideline;}, set: function(_){
            useInteractiveGuideline = _;
        }},
        barColor:  {get: function(){return multibar.barColor;}, set: function(_){
            multibar.barColor(_);
            legend.color(function(d,i) {return d3.rgb('#ccc').darker(i * 1.5).toString();})
        }}
    });

    nv.utils.inheritOptions(chart, multibar);
    nv.utils.initOptions(chart);
    return chart;
};