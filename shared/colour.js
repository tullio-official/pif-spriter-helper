// colour maths
(() => {
  const linear = hex => [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

  function oklch(hex) {
    const [red, green, blue] = linear(hex);
    const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
    const middle = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
    const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
    const lightness = 0.2104542553 * long + 0.7936177850 * middle - 0.0040720468 * short;
    const greenish = 1.9779984951 * long - 2.4285922050 * middle + 0.4505937099 * short;
    const blueish = 0.0259040371 * long + 0.7827717662 * middle - 0.8086757660 * short;
    return { lightness, chroma: Math.hypot(greenish, blueish), hue: (Math.atan2(blueish, greenish) * 180 / Math.PI + 360) % 360 };
  }

  function darker(hex) {
    const { lightness, chroma, hue } = oklch(hex);
    const greenish = chroma * Math.cos(hue * Math.PI / 180), blueish = chroma * Math.sin(hue * Math.PI / 180);
    const dark = Math.max(0, lightness - 0.15);
    const long = (dark + 0.3963377774 * greenish + 0.2158037573 * blueish) ** 3;
    const middle = (dark - 0.1055613458 * greenish - 0.0638541728 * blueish) ** 3;
    const short = (dark - 0.0894841775 * greenish - 1.2914855480 * blueish) ** 3;
    const channels = [4.0767416621 * long - 3.3077115913 * middle + 0.2309699292 * short,
      -1.2684380046 * long + 2.6097574011 * middle - 0.3413193965 * short,
      -0.0041960863 * long - 0.7034186147 * middle + 1.7076147010 * short];
    return channels.map(channel => {
      const value = Math.min(1, Math.max(0, channel));
      return Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0');
    }).join('');
  }

  function ink(hex) {
    const luminance = colour => {
      const [red, green, blue] = linear(colour);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const level = luminance(hex), ratio = (first, second) => (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    return ratio(level, luminance('121b26')) >= ratio(level, luminance('f6f2ee')) ? 'dark' : 'light';
  }

  window.siteColour = { oklch, darker, ink };
})();
