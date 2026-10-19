export const choice = {
  structure_type: 'collector.choose',
  info: {
    stid: 'synthetic',
    st_nr: '<p>Shared passage</p>',
    xtlist: [
      {
        xt_xh: '1',
        xt_nr: 'ets_th1 Choose the river.',
        answer: 'B',
        xt_value: 'M: A hill.\nW: A river.',
        xxlist: [
          { xx_mc: 'A', xx_nr: 'A hill' },
          { xx_mc: 'B', xx_nr: 'A river' },
        ],
      },
      {
        xt_xh: '2',
        xt_nr: 'Choose another response.',
        xxlist: [{ xx_mc: 'A', xx_nr: 'Original option' }],
      },
    ],
  },
};
export const dialogue = {
  structure_type: 'collector.dialogue',
  info: {
    stid: 'dialogue',
    value: 'Shared transcript',
    question: [
      {
        xh: '1',
        ask: 'Original prompt',
        answer: 'Explicit',
        std: [{ value: 'First standard' }],
        ref: [{ value: 'Other reference</br>' }],
        analyze: 'Explanation',
      },
      { xh: '2', ask: 'Second prompt', std: [{ value: 'Second primary' }] },
    ],
  },
};
export const metadata = [
  {
    code_id: 'answer',
    code_json_array: JSON.stringify([
      { stid: 'other', xth: '2', answer: 'D' },
      { stid: 'synthetic', xth: '2', answer: 'A' },
      { stid: 'synthetic', xth: '1', answer: 'C' },
    ]),
  },
];
