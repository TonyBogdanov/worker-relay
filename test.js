const { spawn } = require( 'child_process' );
const path = require( 'path' );
const kill = require( 'tree-kill' );
const browserstack = require( 'browserstack-local' );
const webdriver = require( 'selenium-webdriver' );
const compare = require( 'compare-versions' );
const rimraf = require( 'rimraf' );
const getCapabilities = require( 'browserslist-browserstack' ).default;

function batch( queue ) {

    return new Promise( ( resolve, reject ) => {

        let active = 0,
            finished = false,
            results = [],
            error = undefined;

        const go = () => {

            if ( 5 <= active ) {

                return;

            }

            if ( 0 === queue.length ) {

                if ( finished || 0 < active ) {

                    return;

                }

                finished = true;
                'undefined' !== typeof error ? reject( error ) : resolve( results );

                return;

            }

            active++;
            queue.shift()()
                .then( result => results.push( result ) )
                .catch( e => { error = error ?? e; queue = []; } )
                .finally( () => { active--; go(); } );

            go();

        };

        go();

    } );

}

async function capabilities() {

    console.log( 'Resolving browser capabilities.' );
    const caps = await getCapabilities( {

        username: process.env.BROWSERSTACK_USERNAME,
        accessKey: process.env.BROWSERSTACK_ACCESS_KEY,

    } );

    const candidates = { min: {}, max: {} };
    for ( const cap of caps ) {

        if ( ! candidates.min.hasOwnProperty( cap.browserName ) ||
            0 < compare( candidates.min[ cap.browserName ].browserVersion, cap.browserVersion ) ) {

            candidates.min[ cap.browserName ] = cap;

        }

        if ( ! candidates.max.hasOwnProperty( cap.browserName ) ||
            0 > compare( candidates.max[ cap.browserName ].browserVersion, cap.browserVersion ) ) {

            candidates.max[ cap.browserName ] = cap;

        }

    }

    return Object.values( candidates.min ).concat( Object.values( candidates.max ) )
        .filter( ( v, i, a ) => a.indexOf( v ) === i );

}

async function invoke( callback ) {

    let result = undefined, error = undefined;
    try { result = await callback() } catch ( e ) { error = e }

    return [ result, error ];

}

async function build() {

    console.debug( 'Webpack building.' );
    return new Promise( async ( resolve, reject ) => {

        const p = spawn( 'win32' === process.platform ? 'npm.cmd' : 'npm', [ 'run', 'build' ], { cwd: __dirname } );
        p.on( 'close', e => 0 < e ? reject() : resolve() );

    } );

}

async function ws( callback ) {

    console.debug( 'Starting web-server.' );
    return new Promise( async ( resolve, reject ) => {

        let started = false, stderr = '', result = undefined, error = undefined;

        const p = spawn( 'win32' === process.platform ? 'npx.cmd' : 'npx', [ 'http-server' ], {
            cwd: path.resolve( __dirname, 'dist' ) } );

        const g = async data => {

            if ( started || -1 === data.indexOf( 'to stop the server' ) ) {

                return;

            }

            started = true;
            [ result, error ] = await invoke( callback );

            console.debug( 'Stopping web-server.' );
            kill( p.pid );

        };

        p.stdout.on( 'data', g );
        p.stderr.on( 'data', data => { stderr += data; g( data ) } );

        p.on( 'close', () => ! started ? reject( stderr ) : error ? reject( error ) : resolve( result ) );

    } );

}

async function bs( callback ) {

    console.debug( 'Starting browserstack.' );
    return new Promise( async ( resolve, reject ) => {

        const bs = new browserstack.Local();
        bs.start( { forceLocal: true }, async e => {

            if ( e ) {

                return reject( e );

            }

            if ( ! bs.isRunning() ) {

                return reject( 'BrowserStack Local is not running.' );

            }

            let [ result, error ] = await invoke( callback );

            console.debug( 'Stopping browserstack.' );
            bs.stop( () => error ? reject( error ) : resolve( result ) );

        } );

    } );

}

async function wd( caps, callback ) {

    console.debug( `Starting ${ caps.browserName }@${ caps.browserVersion }.` );
    const p = new webdriver.Builder()
        .usingServer( 'https://hub-cloud.browserstack.com/wd/hub' )
        .withCapabilities( Object.assign( {

            'browserstack.user': process.env.BROWSERSTACK_USERNAME,
            'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
            'build': 'worker-relay',
            'name': 'worker-relay',
            'browserstack.debug': 'true',
            'browserstack.console': 'errors',
            'browserstack.local': true,

        }, caps ) )
        .build();

    const [ result, error ] = await invoke( () => callback( p ) );

    console.debug( `Stopping ${ caps.browserName }@${ caps.browserVersion }.` );
    await p.quit();

    if ( error ) {

        throw error;

    }

    return result;

}

( async () => {

    try {

        rimraf.sync( path.resolve( __dirname, 'dist' ) );
        await build();

        await ws( () => bs( async () => {

            await batch( ( await capabilities() ).map( cap => async () => await wd( cap, async driver => {

                await driver.manage().setTimeouts( { script: 300000, pageLoad: 300000, implicit: 300000 } );
                await driver.get( 'http://localhost:8080' );

                const { ok, stats } = await driver.executeAsyncScript(
                    'window.$selenium=arguments[arguments.length-1]' );

                await driver.executeScript( `browserstack_executor:${ JSON.stringify( { action: 'setSessionStatus',
                    arguments: { status: ok ? 'passed' : 'failed' } } ) }` );

                console.log( `  ${ cap.browserName }@${ cap.browserVersion }: ${ ok ? 'SUCCESS' : 'FAILURE' }\n` );
                for ( const [ group, results ] of Object.entries( stats ) ) {

                    console.log( `    ${ group }` );
                    for ( const line of results ) {

                        console.log( `      ${ line }` );

                    }

                }

                console.log( '' );

                if ( ! ok ) {

                    throw 'Tests failed.';

                }

            } ) ) );

        } ) );

    } catch ( e ) {

        console.error( e );
        process.exit( 1 );

    }

} )();
