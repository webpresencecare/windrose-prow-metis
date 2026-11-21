// Writes theme.json and styles/*.json: Metis's own palette and variations in the common color names, the source
// styles of src/, each with its other scheme (Windrose Livery's calculation, then checked for contrast).
// Usage: node bin/build-styles.mjs   (needs ../metis and ../windrose-livery next to this repository)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const here = new URL( '..', import.meta.url );
const metis = new URL( '../metis/', here );
const livery = new URL( '../windrose-livery/src/mermaid/', here );
const { makeTwins } = await import( new URL( 'twins.js', livery ) );
const { toOklch, fromOklch, toHex, fixContrast } = await import( new URL( 'color.js', livery ) );
const read = ( url ) => JSON.parse( readFileSync( url, 'utf8' ) );
const write = ( path, data ) => writeFileSync( new URL( path, here ), JSON.stringify( data, null, '\t' ) + '\n' );
const NAMES = { base: 'Base', contrast: 'Contrast', 'accent-1': 'Accent', 'accent-3': 'Strong Contrast', 'accent-5': 'Surface', 'accent-6': 'Border' };
const STYLES = { color: { background: 'var(--wp--preset--color--base)', text: 'var(--wp--preset--color--accent-3)' } };

/** Six common colors, the raised surface and the six soft accents => palette with twins, and settings.custom.prow. */
function scheme( six, raised, soft ) {
	const palette = Object.entries( six ).map( ( [ slug, [ name, color ] ] ) => ( { slug, name, color } ) );
	const made = makeTwins( { color: { palette } }, STYLES );
	const other = toOklch( made.twins.find( ( t ) => t.slug.endsWith( '-base' ) ).color );
	const dark = 'dark' === made.scheme;
	const tone = ( color, lift ) => { const o = toOklch( color ); return toHex( fromOklch( { l: dark ? other.l + lift : Math.min( 0.93, other.l - lift / 2 ), c: Math.min( o.c, 0.07 ), h: o.h, a: 1 } ) ); };
	const prow = { raised, [ `${ made.scheme }-raised` ]: toHex( fromOklch( { ...other, l: Math.min( 1, other.l + ( dark ? 0.04 : 0.015 ) ) } ) ) };
	soft.forEach( ( color, i ) => { prow[ `soft-${ i + 1 }` ] = color; prow[ `${ made.scheme }-soft-${ i + 1 }` ] = tone( color, 0.14 ); } );
	return { palette: [ ...palette, ...made.twins ], prow, other: made.scheme, passes: made.passes };
}

/** A Metis palette (theme-1 to theme-12) in the common names. The Accent carries links and buttons in patterns made
 * for the common names: Metis's first soft accent, moved (same hue) until it reaches 4.5 to 1 on the background. */
function fromMetis( list ) {
	const c = Object.fromEntries( list.map( ( e ) => [ Number( e.slug.replace( 'theme-', '' ) ), e ] ) );
	const six = { base: [ c[ 1 ].name, c[ 1 ].color ], contrast: [ c[ 3 ].name, c[ 3 ].color ], 'accent-1': [ c[ 7 ].name, fixContrast( c[ 7 ].color, c[ 1 ].color, 4.5 ) ], 'accent-3': [ c[ 2 ].name, c[ 2 ].color ], 'accent-5': [ c[ 4 ].name, c[ 4 ].color ], 'accent-6': [ 'Border', c[ 2 ].color.slice( 0, 7 ) + '33' ] };
	return scheme( six, c[ 6 ].color, [ 7, 8, 9, 10, 11, 12 ].map( ( n ) => c[ n ].color ) );
}
const report = [];
const base = fromMetis( read( new URL( 'theme.json', metis ) ).settings.color.palette );
write( 'theme.json', { $schema: 'https://schemas.wp.org/trunk/theme.json', version: 3, settings: { color: { palette: base.palette }, custom: { prow: base.prow } } } );
report.push( `theme.json (Metis default): other scheme ${ base.other }, contrast ${ base.passes ? 'passes' : 'FAILS' }` );
for ( const file of readdirSync( new URL( 'styles/', metis ) ).filter( ( f ) => f.endsWith( '.json' ) ) ) {
	const v = read( new URL( `styles/${ file }`, metis ) );
	const made = fromMetis( v.settings.color.palette );
	v.settings = { ...v.settings, color: { ...v.settings.color, palette: made.palette }, custom: { ...v.settings.custom, prow: made.prow } };
	write( `styles/${ file }`, v );
	report.push( `styles/${ file } (${ v.title }): other scheme ${ made.other }, contrast ${ made.passes ? 'passes' : 'FAILS' }` );
}
for ( const file of readdirSync( new URL( 'src/', here ) ).filter( ( f ) => f.endsWith( '.json' ) ) ) {
	const s = read( new URL( `src/${ file }`, here ) );
	const made = scheme( s.palette, s.raised, s.soft );
	write( `styles/${ file }`, { $schema: 'https://schemas.wp.org/trunk/theme.json', version: 3, title: s.title, settings: { color: { palette: made.palette }, custom: { prow: made.prow } }, ...( s.styles ? { styles: s.styles } : {} ) } );
	report.push( `styles/${ file } (${ s.title }): other scheme ${ made.other }, contrast ${ made.passes ? 'passes' : 'FAILS' }` );
}
console.log( report.join( '\n' ) );
if ( report.some( ( line ) => line.endsWith( 'FAILS' ) ) ) {
	process.exitCode = 1;
}
