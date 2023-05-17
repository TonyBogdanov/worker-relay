const { spawn } = require( 'child_process' );
const path = require( 'path' );
const kill = require( 'tree-kill' );
const browserstack = require( 'browserstack-local' );
const webdriver = require( 'selenium-webdriver' );
const compare = require( 'compare-versions' );
const rimraf = require( 'rimraf' );
const getCapabilities = require( 'browserslist-browserstack' ).default;

const username = env( 'BROWSERSTACK_USERNAME' );
const accessKey = env( 'BROWSERSTACK_ACCESS_KEY' );

function env( name ) {
    if ( !process.env.hasOwnProperty( name ) ) {
        throw new Error( `Missing environment variable: ${ name }` );
    }

    return process.env[ name ];
}

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
                .catch( e => {
                    error = error ?? e;
                    queue = [];
                } )
                .finally( () => {
                    active--;
                    go();
                } );

            go();
        };

        go();
    } );
}

async function capabilities() {
    console.log( 'Resolving browser capabilities.' );
    const caps = await getCapabilities( { username, accessKey } );

    const candidates = { min: {}, max: {} };
    for ( const cap of caps ) {
        if ( !candidates.min.hasOwnProperty( cap.browserName ) ||
            0 < compare( candidates.min[ cap.browserName ].browserVersion, cap.browserVersion ) ) {
            candidates.min[ cap.browserName ] = cap;
        }

        if ( !candidates.max.hasOwnProperty( cap.browserName ) ||
            0 > compare( candidates.max[ cap.browserName ].browserVersion, cap.browserVersion ) ) {
            candidates.max[ cap.browserName ] = cap;
        }
    }

    return Object.values( candidates.min )
        .concat( Object.values( candidates.max ) )
        .filter( ( v, i, a ) => a.indexOf( v ) === i );
}

async function invoke( callback ) {
    let result = undefined, error = undefined;
    try {
        result = await callback()
    } catch ( e ) {
        error = e
    }

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
        const p = spawn( 'win32' === process.platform ? 'npx.cmd' : 'npx', [ 'http-server', '-p', '8999' ], {
            cwd: path.resolve( __dirname, 'dist' )
        } );

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
        p.stderr.on( 'data', data => {
            stderr += data;
            g( data )
        } );

        p.on( 'close', () => !started ? reject( stderr ) : error ? reject( error ) : resolve( result ) );
    } );
}

async function bs( callback ) {
    console.debug( 'Starting browserstack.' );

    return new Promise( async ( resolve, reject ) => {
        const bs = new browserstack.Local();
        bs.start( { forceLocal: true, key: accessKey }, async e => {
            if ( e ) {
                return reject( e );
            }

            if ( !bs.isRunning() ) {
                return reject( 'BrowserStack Local is not running.' );
            }

            let [ result, error ] = await invoke( callback );

            console.debug( 'Stopping browserstack.' );
            bs.stop( () => error ? reject( error ) : resolve( result ) );
        } );
    } );
}

async function wd( cap, callback ) {
    let builder = new webdriver.Builder()
        .forBrowser( cap.browserName )
        .usingServer( 'https://hub-cloud.browserstack.com/wd/hub' )
        .withCapabilities( {
            browserName: cap.browserName,
            'bstack:options': {
                userName: username,
                accessKey: accessKey,
                buildName: 'worker-relay',
                projectName: 'worker-relay',
                sessionName: 'worker-relay',
                os: cap.os,
                osVersion: cap.os_version,
                browserVersion: cap.browser_version,
                debug: true,
                local: true,
            },
        } );

    console.debug( `Starting ${ cap.browserName }@${ cap.browserVersion }.` );
    const driver = builder.build();

    const [ result, error ] = await invoke( () => callback( driver ) );

    console.debug( `Stopping ${ cap.browserName }@${ cap.browserVersion }.` );
    await driver.quit();

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
                await driver.get( 'http://localhost:8999' );

                const { ok, stats } = await driver.executeAsyncScript(
                    'window.$selenium=arguments[arguments.length-1]' );

                await driver.executeScript( `browserstack_executor:${ JSON.stringify( {
                    action: 'setSessionStatus',
                    arguments: { status: ok ? 'passed' : 'failed' }
                } ) }` );

                console.log( `  ${ cap.browserName }@${ cap.browserVersion }: ${ ok ? 'SUCCESS' : 'FAILURE' }\n` );
                for ( const [ group, results ] of Object.entries( stats ) ) {
                    console.log( `    ${ group }` );

                    for ( const line of results ) {
                        console.log( `      ${ line }` );
                    }
                }

                if ( !ok ) {
                    throw 'Tests failed.';
                }
            } ) ) );
        } ) );
    } catch ( e ) {
        console.error( e );
        process.exit( 1 );
    }
} )();
