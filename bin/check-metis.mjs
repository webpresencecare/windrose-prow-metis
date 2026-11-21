// Fails loudly when Metis changes what this theme stands on: its twelve color names, its twelve gradients, and the
// replaceable function behind its Dark Mode switch. Usage: node bin/check-metis.mjs [--remote]
// Default: the clone next to this repository (../metis). --remote: WordPress/metis on GitHub, branch trunk.
import { readFileSync } from 'node:fs';
const remote = process.argv.includes( '--remote' );
const get = async ( file ) =>
	remote
		? ( await fetch( `https://raw.githubusercontent.com/WordPress/metis/trunk/${ file }` ) ).text()
		: readFileSync( new URL( `../../metis/${ file }`, import.meta.url ), 'utf8' );
const numbers = Array.from( { length: 12 }, ( _, i ) => i + 1 );
const theme = JSON.parse( await get( 'theme.json' ) );
const functions = await get( 'functions.php' );
const same = ( a, b ) => JSON.stringify( a ) === JSON.stringify( b );
const problems = [];
const colors = ( theme.settings?.color?.palette ?? [] ).map( ( c ) => c.slug );
if ( ! same( colors, numbers.map( ( n ) => `theme-${ n }` ) ) ) {
	problems.push( `Color names changed: ${ colors.join( ', ' ) }` );
}
const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
const files = [ 'theme.json', ...[ 'aeaea', 'aeolia', 'cimmeria', 'ismarus', 'ithaca', 'ogygia' ].map( ( name ) => `styles/${ name }.json` ) ];
for ( const file of files ) {
	// The build reads each color as six or eight hex digits.
	const palette = ( 'theme.json' === file ? theme : JSON.parse( await get( file ) ) ).settings?.color?.palette ?? [];
	const odd = palette.filter( ( c ) => ! HEX.test( c.color ) ).map( ( c ) => `${ c.slug } ${ c.color }` );
	if ( 12 !== palette.length || odd.length ) {
		problems.push( `${ file }: ${ palette.length } colors${ odd.length ? `, not hex: ${ odd.join( ', ' ) }` : '' }` );
	}
}
const gradients = ( theme.settings?.color?.gradients ?? [] ).map( ( g ) => g.slug );
if ( ! same( gradients, numbers.map( ( n ) => `gradient-${ n }` ) ) ) {
	problems.push( `Gradient names changed: ${ gradients.join( ', ' ) }` );
}
for ( const needle of [ "function_exists( 'metis_mode_toggle_colors' )", 'data-metis-mode="dark"', 'metis-mode-toggle', "--wp--preset--color--{$color['slug']}" ] ) {
	if ( ! functions.includes( needle ) ) {
		problems.push( `functions.php no longer contains: ${ needle }` );
	}
}
if ( problems.length ) {
	console.error( `Metis (${ remote ? 'GitHub trunk' : '../metis' }) changed:\n- ${ problems.join( '\n- ' ) }` );
	process.exit( 1 );
}
console.log( `Metis (${ remote ? 'GitHub trunk' : '../metis' }): the names and the switch this theme stands on are unchanged.` );
