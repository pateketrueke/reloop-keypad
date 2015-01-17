var VENDOR = 'ReLoop',
    PRODUCT = 'KeyPad',
    VERSION = '1.0';

var ID1 = 'Reloop KeyPad',
    ID2 = 'Reloop KeyPad MIDI 1',
    ID3 = 'F0 AD F5 01 11 02 F7',
    ID4 = 'F0 7E ?? 06 02 AD F5 ?? ?? F7';

var GUID = '372057e0-248e-11e4-8c21-0800200c9a66';

var RL = {
  PLAY: 105,
  PLAYS: 108,
  STOP: 106,
  STOPS: 109,
  RECORD: 107,
  RECORDS: 110,

  OCTAVE_DOWNS: 111,
  OCTAVE_UPS: 112,
  CHANNEL1: 177,

  OVERDUB: false,
  IS_PLAYING: false,
  IS_RECORDING: false,

  CC_MAPPINGS: [],
  CC_ACTIONS: {},
  CC_PARAMS: {},
  CC_STATE: {},

  DEBUG: false
};

var PARAMS = {
  E: { type: 'encoder' },
  K: { type: 'knob' },
  B: { type: 'button' },
  F: { type: 'fader' },
  P: { type: 'pad' },
  S: { shift: true },
  I: { inverted: true },
  M: { toggle: true },
  N: { toggle: false }
};

function actionFor(status, data1, data2) {
  // RECORDING
  var on = data2 > 65;

  if (data1 === RL.PLAY) {
    return { type: 'play', toggle: on };
  } if (data1 === RL.PLAYS) {
    return { type: 'play-all', toggle: on };
  } else if (data1 === RL.STOP) {
    return { type: 'stop', toggle: on };
  } else if (data1 === RL.STOPS) {
    return { type: 'stop-all', toggle: on };
  } else if (data1 === RL.RECORD) {
    return { type: 'record', toggle: on };
  } else if (data1 === RL.RECORDS) {
    return { type: 'overdub', toggle: on };
  }

  for (var i = 0, c = RL.CC_MAPPINGS.length; i < c; i += 1) {
    var ref = RL.CC_MAPPINGS[i];

    if (ref.channel === status && ref.index === data1) {
      var copy = {};

      for (var k in ref) {
        copy[k] = ref[k];
      }

      return copy;
    }
  }
}

function execute(action) {
  debug(action.execute ? 'EX' : 'CC', action);

  switch (action.type) {
    case 'overdub':
      if (action.toggle) {
        RL.TRANSPORT.toggleOverdub();
      }
    break;

    case 'record':
      if (action.toggle) {
        RL.TRANSPORT.record();
        RL.IS_RECORDING = !RL.IS_RECORDING;
      }
    break;

    case 'play':
      if (action.toggle) {
        RL.TRANSPORT.play();
      }
    break;

    case 'play-all':
      for (var i = 0; i < 8; i += 1) {
        RL.TRACKS.getClipLauncherScenes().launch(i);
      }
    break;

    case 'stop':
      if (action.toggle) {
        if (RL.IS_RECORDING) {
          RL.TRANSPORT.record();
        }

        RL.IS_RECORDING = false;
        RL.IS_PLAYING = false;

        RL.TRANSPORT.stop();
      }
    break;

    case 'stop-all':
      RL.TRACKS.getClipLauncherScenes().stop();
    break;

    default:
      action.value = [127, 0][+action.toggle] || action.level || 0;

      if (action.command) {
        var run = RL.CC_ACTIONS[action.command];

        action.state = !!RL.CC_STATE[action.offset];

        run(action);

        if (!action.toggle && action.state) {
          sendMidi(action.channel, action.index, 127);
        }
      } else {
        RL.U_CONTROLS.getControl(action.offset).set(action.value, 128);
      }
    break;
  }
}

function debug() {
  if (arguments.length === 1) {
    return (RL.DEBUG = !!arguments[0]);
  }

  if (!RL.DEBUG) {
    return;
  }

  function dump(obj) {
    if (obj === true) {
      return 'true';
    }

    if (obj === false) {
      return 'false';
    }

    if (typeof obj === 'function') {
      return obj.toString().replace(/[\r\n\t\s]+/g, ' ');
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    var out = [];

    for (var k in obj) {
      var v = dump(obj[k]);

      out.push(obj instanceof Array ? v : (k + ': ' + v));
    }

    if (obj instanceof Array) {
      return '[ ' + out.join(', ') + ' ]';
    }

    return '{ ' + out.join(', ') + ' }';
  }

  var out = [];

  for (var i = 0, a; typeof (a = arguments[i]) !== 'undefined'; i += 1) {
    out.push(dump(a));
  }

  println('> ' + out.join(' '));
}

function $(_, key) {
  var options = _.split(':'),
      args = options[3].split('');

  var copy = {};

  for (var i = 0, v; v = PARAMS[args[i]]; i += 1) {
    for (var k in v) {
      copy[k] = v[k];
    }
  }

  if (options[4]) {
    var values = (options[5] || '').split(',');

    for (var i = 0, v; (v = values[i] || '').length; i += 1) {
      values[i] = /\d+/.test(values[i]) ? +values[i] : values[i];
    }

    copy.command = options[4];
    copy.params = values;
  }

  copy.channel = +options[2];
  copy.index = +options[1];
  copy.track = +options[0];
  copy.offset = key;

  return copy;
}
