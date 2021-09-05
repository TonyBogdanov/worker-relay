import Worker from './worker';
import resolver from './resolver';
import register from '../src/frontend/register';

document.addEventListener( 'DOMContentLoaded', () => setTimeout( async () => {

    register( new Worker(), resolver );

    const suite = {};
    const context = require.context( '../tests', true, /\.js$/, 'lazy' );

    for ( const path of context.keys() ) {

        const rel = path.replace( /^[.\/]+/, '' );
        const group = rel.substr( 0, rel.length - 3 );

        suite[ group ] = ( await import( `../tests/${ rel }` ) ).default;

    }

    if ( 'function' === typeof $selenium ) {

        const results = { ok: true, stats: {} };
        const report = document.createElement( 'ul' );

        report.id = 'mocha-report';
        document.getElementById( 'mocha' ).appendChild( report );

        for ( const [ group, tests ] of Object.entries( suite ) ) {

            const suite = document.createElement( 'li' );
            const h1 = document.createElement( 'h1' );
            const ul = document.createElement( 'ul' );

            suite.classList.add( 'suite' );
            report.appendChild( suite );

            h1.textContent = group;
            suite.appendChild( h1 );
            suite.appendChild( ul );

            results.stats[ group ] = [];
            for ( const [ name, run ] of Object.entries( tests ) ) {

                let error, start = new Date().getTime();
                try { await run( chai.assert ) } catch ( e ) { error = e }

                error ? results.ok = false : 0;
                results.stats[ group ].push( error ? `X ${ error }` :
                    `✓ ${ name } [${ new Date().getTime() - start }ms]` );

                const li = document.createElement( 'li' );
                const h2 = document.createElement( 'h2' );

                li.classList.add( 'test' );
                li.classList.add( 'pass' );
                h2.textContent = results.stats[ group ][ results.stats[ group ].length - 1 ].substr( 2 );

                li.appendChild( h2 );
                suite.appendChild( li );

            }

        }

        $selenium( results );
        return;

    }

    mocha.setup( 'bdd' );

    Object.entries( suite ).forEach( ( [ group, tests ] ) =>
        describe( group, () => Object.entries( tests ).forEach( ( [ name, run ] ) =>
            it( name, async () => run( chai.assert ) ).timeout( 300000 ) ) ) );

    mocha.run();

}, 500 ) );
