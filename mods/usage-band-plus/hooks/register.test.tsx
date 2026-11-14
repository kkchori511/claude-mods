import { expect, test } from 'claude-code/testing'

test('측정값이 없으면 밴드를 그리지 않고 엔진 기본 렌더로 넘긴다', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-default</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-band-plus',
      surface,
      component: 'AbovePrompt',
      props: {
        hasSurvey: false,
        isCollapsed: false,
        isWorking: false,
        maxRows: 20,
        bodyColumns: 120,
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
    expect(await ui.find({ type: 'Text', text: /engine-default/ })).toBeDefined()
    await ui.unmount()
  }
})
