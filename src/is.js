const isFrontend = 'undefined' !== typeof document;

export default {
    what: isFrontend ? 'frontend' : 'backend',

    frontend: isFrontend,
    backend: ! isFrontend,
};
