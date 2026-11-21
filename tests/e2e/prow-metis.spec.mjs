/**
 * Windrose Prow for Metis on a WordPress network with WP-CLI. Environment: WINDROSE_E2E_HOST (the network's host,
 * default localhost), WINDROSE_E2E_USER (a network administrator for WP-CLI, default admin).
 * Works on a throwaway site created here and deleted at the end, never on the network's other sites.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const HOST = process.env.WINDROSE_E2E_HOST ?? 'localhost';
const USER = process.env.WINDROSE_E2E_USER ?? 'admin';
const SLUG = 'prow-metis-e2e';
const SITE = `https://${ HOST }/${ SLUG }/`;
const THEME = fileURLToPath( new URL( '../..', import.meta.url ) ).replace( /\/$/, '' );
const wp = ( ...args ) =>
	execFileSync( 'wp', [ ...args, '--path=/var/www/html/web', `--url=${ SITE }` ], { encoding: 'utf8' } ).trim();
const wpNetwork = ( ...args ) =>
	execFileSync( 'wp', [ ...args, '--path=/var/www/html/web', `--url=https://${ HOST }/` ], { encoding: 'utf8' } ).trim();
const apply = ( title ) => wp( 'eval-file', `${ THEME }/tests/e2e/apply-style.php`, title, `--user=${ USER }` );
const style = ( file ) => JSON.parse( readFileSync( `${ THEME }/${ file }`, 'utf8' ) );
const colors = ( file ) => Object.fromEntries( style( file ).settings.color.palette.map( ( c ) => [ c.slug, c.color ] ) );
const SWITCH =
	'<!-- wp:group {"className":"metis-mode-toggle"} --><div class="wp-block-group metis-mode-toggle"><!-- wp:paragraph --><p>Light and dark</p><!-- /wp:paragraph --></div><!-- /wp:group -->' +
	'<!-- wp:group {"backgroundColor":"theme-7"} --><div class="wp-block-group has-theme-7-background-color has-background"><!-- wp:paragraph --><p>Soft</p><!-- /wp:paragraph --></div><!-- /wp:group -->' +
	'<!-- wp:group {"gradient":"gradient-2"} --><div class="wp-block-group has-gradient-2-gradient-background has-background"><!-- wp:paragraph --><p>Gradient</p><!-- /wp:paragraph --></div><!-- /wp:group -->';

/** What the page shows: colors resolved by the browser, as rgb() or color(). */
const probe = () => {
	const resolve = ( value ) => {
		const d = document.createElement( 'div' );
		d.style.backgroundColor = value;
		document.body.append( d );
		const c = getComputedStyle( d ).backgroundColor;
		d.remove();
		return c;
	};
	const out = {
		background: getComputedStyle( document.body ).backgroundColor,
		text: getComputedStyle( document.body ).color,
		scheme: getComputedStyle( document.documentElement ).colorScheme,
		soft: getComputedStyle( document.querySelector( '.has-theme-7-background-color' ) ).backgroundColor,
		gradient: getComputedStyle( document.querySelector( '.has-gradient-2-gradient-background' ) ).backgroundImage,
	};
	for ( let n = 1; n <= 12; n++ ) {
		out[ n ] = resolve( `var(--wp--preset--color--theme-${ n })` );
	}
	return out;
};
/** A hex color as the browser reports it. */
const rgb = ( hex ) => {
	const [ r, g, b ] = [ 1, 3, 5 ].map( ( i ) => parseInt( hex.slice( i, i + 2 ), 16 ) );
	return `rgb(${ r }, ${ g }, ${ b })`;
};
const visit = async ( browser ) => {
	const context = await browser.newContext( { storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: true } );
	const page = await context.newPage();
	const seen = { external: [], errors: [] };
	page.on( 'request', ( r ) => {
		const u = new URL( r.url() );
		if ( u.hostname !== HOST ) seen.external.push( u.hostname + u.pathname );
	} );
	page.on( 'pageerror', ( e ) => seen.errors.push( e.message ) );
	await page.goto( `${ SITE }switch/` );
	return { context, page, seen };
};

test.describe.configure( { mode: 'serial' } );
let siteId = '';

test.beforeAll( () => {
	// A site left by an interrupted run.
	if ( wpNetwork( 'site', 'list', '--field=path' ).split( '\n' ).includes( `/${ SLUG }/` ) ) {
		wpNetwork( 'site', 'delete', `--slug=${ SLUG }`, '--yes' );
	}
	siteId = wpNetwork( 'site', 'create', `--slug=${ SLUG }`, '--title=Prow Metis e2e', '--email=prow-metis-e2e@example.com', '--porcelain' );
	wp( 'theme', 'enable', 'metis' );
	wp( 'theme', 'enable', 'windrose-prow-metis' );
	wp( 'theme', 'activate', 'windrose-prow-metis' );
	wp( 'post', 'create', '--post_type=page', '--post_status=publish', '--post_title=Switch', '--post_name=switch', `--post_content=${ SWITCH }` );
} );

test.afterAll( () => {
	wpNetwork( 'site', 'delete', `--slug=${ SLUG }`, '--yes' );
	// Core leaves the deleted site's empty uploads folder behind.
	if ( /^\d+$/.test( siteId ) ) {
		rmSync( `/var/www/html/web/wp-content/uploads/sites/${ siteId }`, { recursive: true, force: true } );
	}
} );

test( 'Metis still has the names and the switch this theme stands on', () => {
	execFileSync( 'node', [ `${ THEME }/bin/check-metis.mjs` ], { encoding: 'utf8' } );
} );

test( 'styles: Metis’s six in the common names and Open Sea, one of each', async ( { page } ) => {
	await page.goto( `/${ SLUG }/wp-admin/site-editor.php?p=%2Fstyles` );
	await page.waitForFunction( () => window.wp?.data?.select( 'core' ) );
	const list = await page.evaluate( async () =>
		( await window.wp.data.resolveSelect( 'core' ).__experimentalGetCurrentThemeGlobalStylesVariations() ).map( ( v ) => ( {
			title: v.title,
			slugs: ( v.settings?.color?.palette?.theme ?? [] ).map( ( c ) => c.slug ),
		} ) )
	);
	expect( list.map( ( v ) => v.title ).sort() ).toEqual( [ 'Aeaea', 'Aeolia', 'Cimmeria', 'Ismarus', 'Ithaca', 'Ogygia', 'Open Sea' ] );
	for ( const v of list ) {
		expect( v.slugs.slice( 0, 6 ), v.title ).toEqual( [ 'base', 'contrast', 'accent-1', 'accent-3', 'accent-5', 'accent-6' ] );
		expect( v.slugs.filter( ( s ) => /^theme-\d+$/.test( s ) ), v.title ).toEqual( [] );
	}
} );

test( 'default style: Metis’s twelve colors follow the common names; the switch shows the dark twins and is kept', async ( { browser } ) => {
	apply( 'none' );
	const c = colors( 'theme.json' );
	const custom = style( 'theme.json' ).settings.custom.prow;
	const { context, page, seen } = await visit( browser );
	const light = await page.evaluate( probe );
	expect( light.background ).toBe( rgb( c.base ) );
	expect( light.text ).toBe( rgb( c[ 'accent-3' ] ) );
	expect( light[ 1 ] ).toBe( rgb( c.base ) );
	expect( light[ 2 ] ).toBe( rgb( c[ 'accent-3' ] ) );
	expect( light[ 6 ] ).toBe( rgb( custom.raised ) );
	expect( light[ 7 ] ).toBe( rgb( custom[ 'soft-1' ] ) );
	expect( light.soft ).toBe( rgb( custom[ 'soft-1' ] ) );
	expect( light.gradient ).toContain( rgb( custom[ 'soft-2' ] ) );
	for ( let n = 1; n <= 12; n++ ) {
		expect( light[ n ], `theme-${ n }` ).not.toBe( 'rgba(0, 0, 0, 0)' );
	}
	const button = page.locator( '.metis-mode-toggle' );
	await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
	await button.click();
	await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );
	const dark = await page.evaluate( probe );
	expect( dark.scheme ).toBe( 'dark' );
	expect( dark.background ).toBe( rgb( c[ 'windrose-livery-dark-base' ] ) );
	expect( dark.text ).toBe( rgb( c[ 'windrose-livery-dark-accent-3' ] ) );
	expect( dark[ 6 ] ).toBe( rgb( custom[ 'dark-raised' ] ) );
	expect( dark.soft ).toBe( rgb( custom[ 'dark-soft-1' ] ) );
	expect( dark.gradient ).toContain( rgb( custom[ 'dark-soft-2' ] ) );
	await page.reload();
	expect( ( await page.evaluate( probe ) ).background ).toBe( rgb( c[ 'windrose-livery-dark-base' ] ) );
	await page.keyboard.press( 'Tab' );
	await page.locator( '.metis-mode-toggle' ).focus();
	await page.keyboard.press( 'Enter' );
	expect( ( await page.evaluate( probe ) ).background ).toBe( rgb( c.base ) );
	expect( seen.external ).toEqual( [] );
	expect( seen.errors ).toEqual( [] );
	await context.close();
} );

test( 'Open Sea chosen in the Site Editor: its colors, its soft accents, its dark scheme', async ( { page, browser } ) => {
	await page.goto( `/${ SLUG }/wp-admin/site-editor.php?p=%2Fstyles` );
	await page.getByRole( 'button', { name: 'Browse styles' } ).click();
	await page.getByRole( 'button', { name: 'Open Sea', exact: true } ).or( page.getByLabel( 'Open Sea', { exact: true } ) ).first().click();
	await page.getByRole( 'button', { name: /Review \d+ change/ } ).click();
	const saved = page.waitForResponse( ( r ) => /global-styles/.test( r.url() ) && [ 'POST', 'PUT' ].includes( r.request().method() ) && r.ok() );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).last().click();
	await saved;
	const c = colors( 'styles/open-sea.json' );
	const custom = style( 'styles/open-sea.json' ).settings.custom.prow;
	const { context, page: front, seen } = await visit( browser );
	const light = await front.evaluate( probe );
	expect( light.background ).toBe( rgb( c.base ) );
	expect( light.text ).toBe( rgb( c[ 'accent-3' ] ) );
	expect( light.soft ).toBe( rgb( custom[ 'soft-1' ] ) );
	await front.locator( '.metis-mode-toggle' ).click();
	const dark = await front.evaluate( probe );
	expect( dark.background ).toBe( rgb( c[ 'windrose-livery-dark-base' ] ) );
	expect( dark.soft ).toBe( rgb( custom[ 'dark-soft-1' ] ) );
	expect( seen.external ).toEqual( [] );
	expect( seen.errors ).toEqual( [] );
	await context.close();
} );

test( 'a dark style (Ismarus): the switch shows its light scheme', async ( { browser } ) => {
	expect( apply( 'Ismarus' ) ).toBe( 'applied' );
	const c = colors( 'styles/ismarus.json' );
	const { context, page } = await visit( browser );
	expect( ( await page.evaluate( probe ) ).background ).toBe( rgb( c.base ) );
	await page.locator( '.metis-mode-toggle' ).click();
	const other = await page.evaluate( probe );
	expect( other.scheme ).toBe( 'light' );
	expect( other.background ).toBe( rgb( c[ 'windrose-livery-light-base' ] ) );
	expect( other.text ).toBe( rgb( c[ 'windrose-livery-light-accent-3' ] ) );
	// Metis repaints its dark logos and icons while the switch is on: here in the light scheme's strong text color.
	const ink = c[ 'windrose-livery-light-accent-3' ];
	const paint = [ 1, 3, 5 ].map( ( i ) => String( Math.round( ( parseInt( ink.slice( i, i + 2 ), 16 ) / 255 ) * 1000 ) / 1000 ) );
	expect( await page.locator( '#metis-mode-artwork feColorMatrix' ).getAttribute( 'values' ) ).toBe( `0 0 0 0 ${ paint[ 0 ] } 0 0 0 0 ${ paint[ 1 ] } 0 0 0 0 ${ paint[ 2 ] } 0 0 0 1 0` );
	await context.close();
} );

test( 'six colors without twins, as a style from elsewhere: Metis follows them, the switch shows the neutral dark set', async ( { browser } ) => {
	expect( apply( 'plain' ) ).toBe( 'applied' );
	const { context, page } = await visit( browser );
	const light = await page.evaluate( probe );
	expect( light.background ).toBe( 'rgb(255, 241, 230)' );
	expect( light.text ).toBe( 'rgb(42, 18, 6)' );
	// Calculated from its own colors, not the default style's raised surface and soft accents.
	const own = style( 'theme.json' ).settings.custom.prow;
	expect( light.soft ).not.toBe( 'rgba(0, 0, 0, 0)' );
	expect( light.soft ).not.toBe( rgb( own[ 'soft-1' ] ) );
	expect( light[ 6 ] ).not.toBe( rgb( own.raised ) );
	expect( light.soft ).toBe( await page.evaluate( () => {
		const d = document.createElement( 'div' );
		d.style.backgroundColor = 'color-mix(in oklab, #fff1e6 78%, oklch(from #c2410c l c calc(h + 0)))';
		document.body.append( d );
		const value = getComputedStyle( d ).backgroundColor;
		d.remove();
		return value;
	} ) );
	await page.locator( '.metis-mode-toggle' ).click();
	const dark = await page.evaluate( probe );
	expect( dark.background ).toBe( 'rgb(15, 17, 20)' );
	expect( dark.text ).toBe( 'rgb(255, 255, 255)' );
	expect( dark.soft ).not.toBe( light.soft );
	expect( dark.soft ).not.toBe( rgb( own[ 'dark-soft-1' ] ) );
	expect( dark[ 6 ] ).not.toBe( rgb( own[ 'dark-raised' ] ) );
	await context.close();
} );

test( 'editor: the canvas follows the adapter and the pickers list the common names', async ( { page } ) => {
	apply( 'Open Sea' );
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( e.message ) );
	const c = colors( 'styles/open-sea.json' );
	await page.goto( `/${ SLUG }/wp-admin/post-new.php?post_type=page` );
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	await canvas.locator( 'body' ).waitFor( { timeout: 30000 } );
	const seen = await canvas.locator( 'body' ).evaluate( () => {
		const d = document.createElement( 'div' );
		d.className = 'has-theme-1-background-color';
		document.body.append( d );
		const one = getComputedStyle( d ).backgroundColor;
		d.className = 'has-theme-7-background-color';
		const seven = getComputedStyle( d ).backgroundColor;
		d.remove();
		return { one, seven };
	} );
	expect( seen.one ).toBe( rgb( c.base ) );
	expect( seen.seven ).toBe( rgb( style( 'styles/open-sea.json' ).settings.custom.prow[ 'soft-1' ] ) );
	expect( wp( 'eval', 'echo implode( ",", wp_list_pluck( wp_get_global_settings( array( "color", "palette", "theme" ) ), "slug" ) );' ) ).not.toContain( 'theme-1' );
	expect( errors ).toEqual( [] );
} );
