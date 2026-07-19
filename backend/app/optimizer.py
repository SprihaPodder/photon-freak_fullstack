import numpy as np

def g_soh(soh): return 1.0 if soh >= 90 else min(3.0, 1.0 + 2.0 * (90 - soh) / 20.0)

def optimise(payload):
    # A short-horizon PSO followed by GA: suitable for an interactive API, unlike the 300-step research sweep.
    n, dt, rng = payload["horizon_hours"], 1.0, np.random.default_rng(42)
    cap, initial, target, soh = payload["battery_capacity_kwh"], payload["initial_soc_pct"], payload["target_soc_pct"], payload["soh_pct"]
    ceiling = payload["max_power_kw"] / g_soh(soh)
    solar = np.resize(np.asarray(payload["solar_kw"], float), n); price = np.resize(np.asarray(payload["grid_price_inr"], float), n)
    required = max(0., (target-initial)/100 * cap)
    def repair(x):
        x = np.clip(x, 0, ceiling); remaining = required - x.sum() * dt
        for i in np.argsort(price - 2.5*np.minimum(solar, ceiling)):
            add = min(max(remaining/dt, 0), ceiling-x[i]); x[i] += add; remaining -= add*dt
            if remaining <= 1e-9: break
        return x
    def objective(x):
        x = repair(x.copy()); solar_used = np.minimum(x, solar).sum()*dt
        return (price*x).sum()*dt - 2.5*solar_used + .1*g_soh(soh)*150*np.sum((x/cap)**2)
    refined = payload.get("quality") == "refine"
    pop_size, pso_steps, ga_steps = (40, 60, 60) if refined else (20, 18, 18)
    pop, velocity = rng.uniform(0, ceiling, (pop_size,n)), np.zeros((pop_size,n)); best = pop.copy(); best_f = np.array([objective(x) for x in pop])
    for _ in range(pso_steps):
        leader = best[best_f.argmin()]; velocity = .5*velocity + 1.3*rng.random((pop_size,n))*(best-pop) + 1.3*rng.random((pop_size,n))*(leader-pop)
        pop = np.clip(pop+velocity, 0, ceiling); scores = np.array([objective(x) for x in pop]); mask = scores < best_f; best[mask], best_f[mask] = pop[mask], scores[mask]
    pop = np.clip(best + rng.normal(0, ceiling*.08, best.shape), 0, ceiling)
    for _ in range(ga_steps):
        scores = np.array([objective(x) for x in pop]); elite = pop[np.argsort(scores)[:6]]; children = [elite[i%6].copy() for i in range(pop_size)]
        for child in children[6:]:
            a,b = elite[rng.integers(6)], elite[rng.integers(6)]; cut=rng.integers(1,n); child[:] = np.r_[a[:cut],b[cut:]]; child += rng.normal(0, ceiling*.04,n)
        pop=np.clip(np.array(children),0,ceiling)
    schedule=repair(pop[np.argmin([objective(x) for x in pop])].copy()); soc=initial+np.cumsum(schedule)*dt/cap*100
    return {"quality": "refined" if refined else "quick", "schedule_kw": schedule.round(3).tolist(), "soc_pct": soc.round(2).tolist(), "total_cost_inr": round(float((price*schedule).sum()*dt),2), "solar_used_kwh": round(float(np.minimum(schedule,solar).sum()*dt),2), "peak_c_rate": round(float(schedule.max()/cap),4), "final_soc_pct": round(float(soc[-1]),2), "max_power_used_kw": round(float(ceiling),2), "g_factor": g_soh(soh)}
