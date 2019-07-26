function newAAVikingsPlotterLinearRegressionCurveLRC() {

    let thisObject = {

        // Main functions and properties.

        initialize: initialize,
        finalize: finalize,
        container: undefined,
        getContainer: getContainer,
        setTimePeriod: setTimePeriod,
        setDatetime: setDatetime,
		recalculateScale: recalculateScale,
        draw: draw,

        /* Events declared outside the plotter. */

        onDailyFileLoaded: onDailyFileLoaded,

        // Secondary functions and properties.

        currentLRC: undefined
    };

    /* this is part of the module template */

    let container = newContainer();     // Do not touch this 3 lines, they are just needed.
    container.initialize();
    thisObject.container = container;

    let timeLineCoordinateSystem = newTimeLineCoordinateSystem();       // Needed to be able to plot on the timeline, otherwise not.

    let timePeriod;                     // This will hold the current Time Period the user is at.
    let datetime;                       // This will hold the current Datetime the user is at.

    let marketFile;                     // This is the current Market File being plotted.
    let fileCursor;                     // This is the current File Cursor being used to retrieve Daily Files.

    let marketFiles;                      // This object will provide the different Market Files at different Time Periods.
    let dailyFiles;                // This object will provide the different File Cursors at different Time Periods.

    /* these are module specific variables: */

    let lrcPoints = [];                   // Here we keep the LRCPoints to be ploted every time the Draw() function is called by the AAWebPlatform.

    let zoomChangedEventSubscriptionId
    let offsetChangedEventSubscriptionId
    let filesUpdatedEventSubscriptionId
    let dragFinishedEventSubscriptionId
    let dimmensionsChangedEventSubscriptionId

    return thisObject;

    function initialize(pStorage, pExchange, pMarket, pDatetime, pTimePeriod, callBackFunction) {

        /* Store the information received. */

        marketFiles = pStorage.marketFiles[0];
        dailyFiles = pStorage.dailyFiles[0];

        datetime = pDatetime;
        timePeriod = pTimePeriod;

        /* We need a Market File in order to calculate the Y scale, since this scale depends on actual data. */

        marketFile = marketFiles.getFile(ONE_DAY_IN_MILISECONDS);  // This file is the one processed faster.

        recalculateScale();

        /* Now we set the right files according to current Period. */

        marketFile = marketFiles.getFile(pTimePeriod);
        fileCursor = dailyFiles.getFileCursor(pTimePeriod);

        /* Listen to the necesary events. */

        zoomChangedEventSubscriptionId = viewPort.eventHandler.listenToEvent("Zoom Changed", onZoomChanged);
        offsetChangedEventSubscriptionId = viewPort.eventHandler.listenToEvent("Offset Changed", onOffsetChanged);
        filesUpdatedEventSubscriptionId = marketFiles.eventHandler.listenToEvent("Files Updated", onFilesUpdated);
        dragFinishedEventSubscriptionId = canvas.eventHandler.listenToEvent("Drag Finished", onDragFinished);

        /* Get ready for plotting. */

        recalculate();

        dimmensionsChangedEventSubscriptionId = thisObject.container.eventHandler.listenToEvent('Dimmensions Changed', function () {
            recalculateScale();
            recalculate();
        })

        callBackFunction();

    }

    function getContainer(point) {

        let container;

        /* First we check if this point is inside this space. */

        if (this.container.frame.isThisPointHere(point) === true) {

            return this.container;

        } else {

            /* This point does not belong to this space. */

            return undefined;
        }

    }

    function onFilesUpdated() {

        let newMarketFile = marketFiles.getFile(timePeriod);

        if (newMarketFile !== undefined) {

            marketFile = newMarketFile;
            recalculate();
        }

    }

    function setTimePeriod(pTimePeriod) {

        if (timePeriod !== pTimePeriod) {

            timePeriod = pTimePeriod;

            if (timePeriod >= _1_HOUR_IN_MILISECONDS) {

                let newMarketFile = marketFiles.getFile(pTimePeriod);

                if (newMarketFile !== undefined) {

                    marketFile = newMarketFile;
                    recalculate();
                }

            } else {

                let newFileCursor = dailyFiles.getFileCursor(pTimePeriod);

                if (newFileCursor !== undefined) {

                    fileCursor = newFileCursor;
                    recalculate();
                }
            }
        }
    }

    function setDatetime(pDatetime) {

        datetime = pDatetime;

    }


    function onDailyFileLoaded(event) {

        if (event.currentValue === event.totalValue) {

            /* This happens only when all of the files in the cursor have been loaded. */

            recalculate();

        }
    }

    function draw() {

        this.container.frame.draw();

        plotChart();

    }

    function recalculate() {

        if (timePeriod >= _1_HOUR_IN_MILISECONDS) {

            recalculateUsingMarketFiles();

        } else {

            recalculateUsingDailyFiles();

        }

        thisObject.container.eventHandler.raiseEvent("Channel Changed", lrcPoints);
    }

    function recalculateUsingDailyFiles() {

        if (fileCursor === undefined || fileCursor.files === undefined) { return; } // We need to wait

        if (fileCursor.files.size === 0) { return;} // We need to wait until there are files in the cursor

        let daysOnSides = getSideDays(timePeriod);

        let leftDate = getDateFromPoint(viewPort.visibleArea.topLeft, thisObject.container, timeLineCoordinateSystem);
        let rightDate = getDateFromPoint(viewPort.visibleArea.topRight, thisObject.container, timeLineCoordinateSystem);

        let dateDiff = rightDate.valueOf() - leftDate.valueOf();

        let farLeftDate = new Date(leftDate.valueOf() - dateDiff * 1.5);
        let farRightDate = new Date(rightDate.valueOf() + dateDiff * 1.5);

        let currentDate = new Date(farLeftDate.valueOf());

        lrcPoints = [];

        while (currentDate.valueOf() <= farRightDate.valueOf() + ONE_DAY_IN_MILISECONDS) {

            let stringDate = currentDate.getFullYear() + '-' + pad(currentDate.getMonth() + 1, 2) + '-' + pad(currentDate.getDate(), 2);

            let dailyFile = fileCursor.files.get(stringDate);

            if (dailyFile !== undefined) {

                for (let i = 0; i < dailyFile.length; i++) {

                    addLRCPointToPlotter(dailyFile[i], farLeftDate, farRightDate);

                }
            }

            currentDate = new Date(currentDate.valueOf() + ONE_DAY_IN_MILISECONDS);
        }

        /* Lests check if all the visible screen is going to be covered by lrcPoints. */

        let lowerEnd = leftDate.valueOf();
        let upperEnd = rightDate.valueOf();

        if (lrcPoints.length > 0) {

            if (lrcPoints[0].begin > lowerEnd || lrcPoints[lrcPoints.length - 1].end < upperEnd) {

                setTimeout(recalculate, 2000);

            }
        }

    }

    function addLRCPointToPlotter(pLRCPoint, leftDate, rightDate ) {
        let lrcPoint = {
            begin: pLRCPoint[0],
            end: pLRCPoint[1],
            min: pLRCPoint[2],
            mid: pLRCPoint[3],
            max: pLRCPoint[4]
        }

        if (lrcPoint.begin >= leftDate.valueOf() && lrcPoint.end <= rightDate.valueOf()) {

            lrcPoints.push(lrcPoint);

            if (datetime.valueOf() >= lrcPoint.begin && datetime.valueOf() <= lrcPoint.end) {

                thisObject.currentLRC = lrcPoint;
                thisObject.container.eventHandler.raiseEvent("Current LRC Changed", thisObject.currentLRC);

            }
        }
    }

    function recalculateUsingMarketFiles() {

        if (marketFile === undefined) { return; } // Initialization not complete yet.

        let daysOnSides = getSideDays(timePeriod);

        let leftDate = getDateFromPoint(viewPort.visibleArea.topLeft, thisObject.container, timeLineCoordinateSystem);
        let rightDate = getDateFromPoint(viewPort.visibleArea.topRight, thisObject.container, timeLineCoordinateSystem);

        let dateDiff = rightDate.valueOf() - leftDate.valueOf();

        leftDate = new Date(leftDate.valueOf() - dateDiff * 1.5);
        rightDate = new Date(rightDate.valueOf() + dateDiff * 1.5);

        lrcPoints = [];

        for (let i = 0; i < marketFile.length; i++) {

            addLRCPointToPlotter(marketFile[i], leftDate, rightDate);

        }

    }

    function recalculateScale() {

        if (marketFile === undefined) { return; } // We need the market file to be loaded to make the calculation.

        if (timeLineCoordinateSystem.maxValue > 0) { return; } // Already calculated.

        let minValue = {
            x: MIN_PLOTABLE_DATE.valueOf(),
            y: 0
        };

        let maxValue = {
            x: MAX_PLOTABLE_DATE.valueOf(),
            y: 25000 //nextPorwerOf10(getMaxRate()) / 4 // TODO: This 4 is temporary
        };

        timeLineCoordinateSystem.initialize(
            minValue,
            maxValue,
            thisObject.container.frame.width,
            thisObject.container.frame.height
        );

        function getMaxRate() {

            let maxValue = 0;

            for (let i = 0; i < marketFile.length; i++) {

                let currentMax = marketFile[i][1];   // 6 = max lrc.

                if (maxValue < currentMax) {
                    maxValue = currentMax;
                }
            }

            return maxValue;

        }
    }

    function plotChart() {

        if (lrcPoints.length > 0) {
            for (var i = 0; i < lrcPoints.length - 1; i++) {

                let currentTime = (lrcPoints[i].begin + lrcPoints[i].end) / 2;
                let nextTime = (lrcPoints[i + 1].begin + lrcPoints[i + 1].end) / 2;

                let currentPoint = {
                    x: lrcPoints[i].begin,
                    y: 0
                }

                let nextPoint = {
                    x: lrcPoints[i + 1].begin,
                    y: 0
                }

                let color = 'rgba(255, 233, 31, 0.40)';
                let currentLRCPoint = false;

                if (datetime !== undefined) {
                    let dateValue = datetime.valueOf();
                    if (dateValue >= lrcPoints[i].begin && dateValue <= lrcPoints[i].end) {
                        currentLRCPoint = true;
                        thisObject.container.eventHandler.raiseEvent("Current LRC Changed", lrcPoints[i]);
                    }
                }

                if (!currentLRCPoint) color = 'rgba(182, 190, 255, 0.95)';
                currentPoint.y = lrcPoints[i].min;
                nextPoint.y = lrcPoints[i+1].min;
                plotLRC(currentPoint, nextPoint, color);

                if (!currentLRCPoint) color = 'rgba(109, 125, 255, 0.95)';
                currentPoint.y = lrcPoints[i].mid;
                nextPoint.y = lrcPoints[i + 1].mid;
                plotLRC(currentPoint, nextPoint, color);

                if (!currentLRCPoint) color = 'rgba(57, 79, 255, 0.95)';
                currentPoint.y = lrcPoints[i].max;
                nextPoint.y = lrcPoints[i + 1].max;
                plotLRC(currentPoint, nextPoint, color);

            }
        }
    }

    function plotLRC(currentLRCPoint, nextLRCPoint, color) {

        currentLRCPoint = timeLineCoordinateSystem.transformThisPoint(currentLRCPoint);
        nextLRCPoint = timeLineCoordinateSystem.transformThisPoint(nextLRCPoint);

        currentLRCPoint = transformThisPoint(currentLRCPoint, thisObject.container);
        nextLRCPoint = transformThisPoint(nextLRCPoint, thisObject.container);

        if (nextLRCPoint.x < viewPort.visibleArea.bottomLeft.x || currentLRCPoint.x > viewPort.visibleArea.bottomRight.x) {
            return;
        }

        currentLRCPoint = viewPort.fitIntoVisibleArea(currentLRCPoint);
        nextLRCPoint = viewPort.fitIntoVisibleArea(nextLRCPoint);

        browserCanvasContext.beginPath();
        browserCanvasContext.moveTo(currentLRCPoint.x, currentLRCPoint.y);
        browserCanvasContext.lineTo(nextLRCPoint.x, nextLRCPoint.y);
        browserCanvasContext.closePath();

        browserCanvasContext.strokeStyle = color;
        browserCanvasContext.fill();
        browserCanvasContext.lineWidth = 1;
        browserCanvasContext.stroke();
    }

    function onZoomChanged(event) {

        recalculate();

    }

    function onOffsetChanged() {
        if (Math.random() * 100 > 95) {
            recalculate()
        };
    }

    function onDragFinished() {

        recalculate();

    }

    function finalize() {
        try {

            /* Stop listening to the necesary events. */

            viewPort.eventHandler.stopListening(zoomChangedEventSubscriptionId);
            viewPort.eventHandler.stopListening(offsetChangedEventSubscriptionId);
            marketFiles.eventHandler.stopListening(filesUpdatedEventSubscriptionId);
            canvas.eventHandler.stopListening(dragFinishedEventSubscriptionId);
            thisObject.container.eventHandler.stopListening(dimmensionsChangedEventSubscriptionId)

            /* Destroyd References */

            marketFiles = undefined;
            dailyFiles = undefined;

            datetime = undefined;
            timePeriod = undefined;

            marketFile = undefined;
            fileCursor = undefined;

        } catch (err) {
            console.log(err)
            // if (ERROR_LOG === true) { logger.write("[ERROR] finalize -> err = " + err.stack); }
        }
    }
}

