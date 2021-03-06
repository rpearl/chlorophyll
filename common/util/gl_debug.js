/* eslint-disable */
/*
 * Debugging functions for OpenGL
 */
export function checkFramebuffer(gl, msg) {
    console.log('checking FBO', msg || '');

    console.log('Alignment:', gl.getParameter(gl.UNPACK_ALIGNMENT));

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
        console.log('Framebuffer complete');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        console.log('Attachment could not be bound');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        console.log('Attachments are missing');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS_EXT:
        console.log('Attached buffer dimensions do not match');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_FORMATS_EXT:
        console.log('Unsupported formats, or do not fit together');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_DRAW_BUFFER:
        console.log('A Draw buffer is incomplete or undefined');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_READ_BUFFER:
        console.log('A Read buffer is incomplete or undefined');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
        console.log('All images must have the same number of multisample samples.');
        break;

    case gl.FRAMEBUFFER_INCOMPLETE_LAYER_TARGETS :
        console.log('Layered/unlayered attached image mismatch');
        break;

    case gl.FRAMEBUFFER_UNSUPPORTED:
        console.log('Attempt to use an unsupported format combinaton');
        break;

    default:
        console.log('Unknown error creating frame buffer object:', status);
        break;
    }
}
const gldbg = false;
let _glTrace;
if (gldbg) {
    _glTrace = function(gl, ctx) {
        const err = gl.getError();
        if (err != 0) {
            console.info(`${ctx}, error=0x${err.toString(16)}`);
        }
        return err;
    };
} else {
    _glTrace = function() {
        return 0;
    };
}

export const glTrace = _glTrace;
