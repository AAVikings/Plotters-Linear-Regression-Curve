function newAAVikingsPlotterLinearRegressionCurveLRCChannelPanel() {

    var thisObject = {
        onEventRaised: onEventRaised,
        container: undefined,
        draw: draw,
        getContainer: getContainer,
        initialize: initialize
    };

    var container = newContainer();
    container.initialize();
    thisObject.container = container;

    container.displacement.containerName = "Current LRC Panel";
    container.frame.containerName = "Current LRC Panel";

    let currentLRCPoint;

    return thisObject;

    function initialize() {

        thisObject.container.frame.width = 150;
        thisObject.container.frame.height = 150;

        thisObject.container.frame.position.x = viewPort.visibleArea.topRight.x - 156 ;
        thisObject.container.frame.position.y = 70 ;

    }

    function getContainer(point) {

        var container;

        /* First we check if this point is inside this space. */

        if (this.container.frame.isThisPointHere(point, true) === true) {

            return this.container;

        } else {

            /* This point does not belong to this space. */

            return undefined;
        }

    }

    function onEventRaised(lastCurrentCandle) {

        currentLRCPoint = lastCurrentCandle;

    }

    function draw() {

        this.container.frame.draw(false, false, true);

        plotCurrentLRCInfo();

    }

    function plotCurrentLRCInfo() {

        if (currentLRCPoint === undefined) { return; }

        const frameBodyHeight = thisObject.container.frame.getBodyHeight();
        const frameTitleHeight = thisObject.container.frame.height - frameBodyHeight;

        const X_AXIS = thisObject.container.frame.width / 2;

        browserCanvasContext.beginPath();

        /* put the labels with the candles values */
        
        let y;

        printLabel('15 Candle History:', X_AXIS, frameTitleHeight + frameBodyHeight * 0.15, '1');
        printLabel(currentLRCPoint.min, X_AXIS, frameTitleHeight + frameBodyHeight * 0.25, '0.50');

        printLabel('30 Candle History:', X_AXIS, frameTitleHeight + frameBodyHeight * 0.45, '1');
        printLabel(currentLRCPoint.mid, X_AXIS, frameTitleHeight + frameBodyHeight * 0.55, '0.50');

        printLabel('60 Candle History:', X_AXIS, frameTitleHeight + frameBodyHeight * 0.75, '1');
        printLabel(currentLRCPoint.max, X_AXIS, frameTitleHeight + frameBodyHeight * 0.85, '0.50');
        
        function printLabel(labelToPrint, x, y, opacity) {

            let labelPoint;
            let fontSize = 10;

            browserCanvasContext.font = fontSize + 'px Courier New';

            let label = '' + labelToPrint;

            let xOffset = label.length / 2 * fontSize * FONT_ASPECT_RATIO;

            labelPoint = {
                x: x - xOffset,
                y: y
            };

            labelPoint = thisObject.container.frame.frameThisPoint(labelPoint);

            browserCanvasContext.fillStyle = 'rgba(60, 60, 60, ' + opacity + ')';
            browserCanvasContext.fillText(label, labelPoint.x, labelPoint.y);

        }

        browserCanvasContext.closePath();
        browserCanvasContext.fill();

    }
}

