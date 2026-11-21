# Fonts embedded in PDF files

PDF files are exported as vectors with
[svg2pdf.js](https://github.com/yWorks/svg2pdf.js). The standard PDF fonts only
cover Western European characters, so the chart font is embedded in the file.
These fonts are only downloaded when a PDF file is exported, and jsPDF only
embeds the characters that are used.

- `Montserrat-*.ttf`: subsets of
  [Montserrat](https://github.com/JulietaUla/Montserrat) (SIL Open Font License
  1.1, see `Montserrat-OFL.txt`), the font of the charts, with Latin, Cyrillic
  and Vietnamese characters.
- `DejaVuSans-Symbols.ttf`: the Miscellaneous Symbols block of
  [DejaVu Sans](https://dejavu-fonts.github.io/) (see `DejaVu-LICENSE.txt`), for
  symbols missing in Montserrat, such as ♂, ♀ and ⚭.

They were created with [fontTools](https://github.com/fonttools/fonttools),
without the hinting and layout tables, which jsPDF doesn't use:

```sh
pyftsubset Montserrat-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-024F,U+0259,U+02B0-02FF,U+0300-036F,U+0400-052F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2212,U+FB01-FB02" \
  --layout-features='' --no-hinting --drop-tables+=GPOS,GSUB,kern,DSIG \
  --output-file=Montserrat-Regular.ttf
# Same for Montserrat-Bold.ttf and Montserrat-Italic.ttf.

pyftsubset DejaVuSans.ttf --unicodes="U+2600-26FF" \
  --layout-features='' --no-hinting --drop-tables+=GPOS,GSUB,kern \
  --output-file=DejaVuSans-Symbols.ttf
```
