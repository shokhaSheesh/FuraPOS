import { describe, expect, it } from 'vitest'
import { useDataStore } from '@/data/store'
import { sameName, vehicleUsage } from './settings'

const store = () => useDataStore.getState()
const make = (name: string) => store().vehicleMakes.find((m) => m.name === name)

describe('sameName', () => {
  it('treats spacing and case as the same model', () => {
    expect(sameName('XF 105', 'xf105')).toBe(true)
    expect(sameName('XF 105', 'XF 95')).toBe(false)
  })
})

describe('the starting list', () => {
  it('covers every make and model already on a truck, so nothing falls outside it', () => {
    for (const driver of store().drivers) {
      for (const truck of [
        ...driver.ownTrucks,
        ...(driver.autoparkTruck ? [driver.autoparkTruck] : []),
      ]) {
        if (!truck.make) continue
        const listed = make(truck.make)
        expect(listed, truck.make).toBeDefined()
        if (truck.model)
          expect(
            listed!.models.some((m) => m.name === truck.model),
            truck.model,
          ).toBe(true)
      }
    }
  })
})

describe('truck brands and models', () => {
  it('refuses a brand that is already there under another spelling', () => {
    expect(store().createVehicleMake('daf').ok).toBe(false)
  })

  it('refuses a model that is already there under another spelling', () => {
    const daf = make('DAF')!
    expect(store().addVehicleModel(daf.id, 'xf105').ok).toBe(false)
  })

  it('adds a model to a brand', () => {
    const daf = make('DAF')!
    expect(store().addVehicleModel(daf.id, 'XG+')).toEqual({ ok: true })
    expect(make('DAF')!.models.some((m) => m.name === 'XG+')).toBe(true)
  })

  it('renames a model on every product and truck of that brand', () => {
    const daf = make('DAF')!
    const xf105 = daf.models.find((m) => m.name === 'XF 105')!
    const before = vehicleUsage('DAF', 'XF 105', store().products, trucks())
    expect(before.products + before.trucks).toBeGreaterThan(0)

    expect(store().renameVehicleModel(daf.id, xf105.id, 'XF 105 Euro 6')).toEqual({ ok: true })

    expect(vehicleUsage('DAF', 'XF 105', store().products, trucks())).toEqual({
      products: 0,
      trucks: 0,
    })
    expect(vehicleUsage('DAF', 'XF 105 Euro 6', store().products, trucks())).toEqual(before)
    // The flat catalogue rows follow the nested products.
    expect(store().variations.some((v) => v.vehicleModels.includes('XF 105'))).toBe(false)
  })

  it('renames a brand everywhere it is used', () => {
    const man = make('MAN')!
    const before = vehicleUsage('MAN', null, store().products, trucks())
    expect(store().renameVehicleMake(man.id, 'MAN Truck & Bus')).toEqual({ ok: true })
    expect(vehicleUsage('MAN Truck & Bus', null, store().products, trucks())).toEqual(before)
    expect(vehicleUsage('MAN', null, store().products, trucks())).toEqual({
      products: 0,
      trucks: 0,
    })
  })

  it('will not delete a model that products or trucks still use', () => {
    const volvo = make('Volvo')!
    const used = volvo.models.find(
      (m) => vehicleUsage('Volvo', m.name, store().products, trucks()).products > 0,
    )!
    const result = store().deleteVehicleModel(volvo.id, used.id)
    expect(result.ok).toBe(false)
  })

  it('deletes a model nothing uses', () => {
    const scania = make('Scania')!
    store().addVehicleModel(scania.id, 'G 999')
    const added = make('Scania')!.models.find((m) => m.name === 'G 999')!
    expect(store().deleteVehicleModel(scania.id, added.id)).toEqual({ ok: true })
  })

  it('will not delete a brand in use, but deletes an unused one', () => {
    expect(store().deleteVehicleMake(make('Scania')!.id).ok).toBe(false)
    const created = store().createVehicleMake('Test brand nobody uses')
    expect(created.ok).toBe(true)
    if (created.ok) expect(store().deleteVehicleMake(created.make.id)).toEqual({ ok: true })
  })
})

function trucks() {
  return store().drivers.flatMap((d) => [
    ...d.ownTrucks,
    ...(d.autoparkTruck ? [d.autoparkTruck] : []),
  ])
}
