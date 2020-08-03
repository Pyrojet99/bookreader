//@ts-check
const BookReader = /** @type {typeof import('../BookReader').default} */(window.BookReader);

class TextSelectionPlugin {

  constructor() {
    /**@type {PromiseLike<JQuery<HTMLElement>>} */
    this.djvuPagesPromise = null;
  }

  /**
   * @param {string} ocaid
   */
  init(ocaid) {
    this.djvuPagesPromise = $.ajax({
      type: "GET",
      url: `https://cors.archive.org/cors/${ocaid}/${ocaid}_djvu.xml`,
      dataType: "xml",

      error: function (e) {
        return undefined;
      }
    }).then(function (response) {
      const xmlMap = response;

      if (xmlMap != undefined) {
        return $(xmlMap).find("OBJECT");
      }
    });
  }

  /**
   * @param {number} index
   * @returns {Promise<HTMLElement>}
   */
  async getPageText(index) {
    return (await this.djvuPagesPromise)[index];
  }

  /**
   * @param {JQuery} $container
   */
  stopPageFlip($container){
    const $svg = $container.find('svg');
    $svg.on("mousedown", (event) => {
      if ($(event.target).is('text')) {
        event.stopPropagation();
        $container.one("mouseup", (event) => event.stopPropagation());
      }
    });
  }

  /**
   * @param {number} pageIndex
   * @param {JQuery} $container
   */
  async createTextLayer(pageIndex, $container) {
    const $svgLayers = $container.find('textSelctionSVG');
    if (!$svgLayers.length) {
      const XMLpage = await this.getPageText(pageIndex);
      const XMLwidth = $(XMLpage).attr("width");
      const XMLheight = $(XMLpage).attr("height");

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 " + XMLwidth + " " + XMLheight);
      $container.append(svg);
      $(svg).addClass('textSelctionSVG');
      svg.setAttribute('preserveAspectRatio', 'none');
      $(svg).css({
        "width": "100%",
        "position": "absolute",
        "height": "100%",
        "top": "0",
        "left": "0",
      });

      $(XMLpage).find("LINE").each((i, line) => {
        const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "text");
        let lineString = "";
        let [leftMin, bottomMax, rightMax, topMin] = [Infinity, 0, 0, Infinity];
        $(line).find("WORD").each((i, word) => {
          // eslint-disable-next-line no-unused-vars
          const [left, bottom, right, top] = $(word).attr("coords").split(',').map(parseFloat);
          if(left < leftMin) leftMin = left;
          if(bottom > bottomMax) bottomMax = bottom;
          if(right > rightMax) rightMax = right;
          if(top < topMin) topMin = top;
          lineString = lineString + " " + word.textContent;
        });
        lineSvg.setAttribute("x", leftMin.toString());
        lineSvg.setAttribute("y", bottomMax.toString());
        lineSvg.setAttribute("font-size", (bottomMax - topMin).toString());
        lineSvg.setAttribute("textLength", (rightMax - leftMin).toString());
        $(lineSvg).css({
          //"fill": "red",
          "cursor": "text",
          "fill-opacity": "0",
          "dominant-baseline": "text-after-edge",
        });
        const lineTextNode = document.createTextNode(lineString);
        lineSvg.append(lineTextNode);
        svg.append(lineSvg);
      })
      this.stopPageFlip($container);
    }
  }
}

class BookreaderWithTextSelection extends BookReader {
  init() {
    if(this.enableTextSelection){
      this.enableTextSelection = true;
      const OCAID = this.bookId;
      this.textSelectionPlugin = new TextSelectionPlugin();
      this.textSelectionPlugin.init(OCAID);
    }
    super.init();
  }

  /**
   * @param {PageModel} page
   */
  _createPageContainer(page, styles = {}) {
    const $container = super._createPageContainer(page, styles);
    if(this.enableTextSelection){
      this.textSelectionPlugin.createTextLayer(page.index, $container);
    }
    return $container;
  }
}
window.BookReader = BookreaderWithTextSelection;