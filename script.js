document.addEventListener('DOMContentLoaded', () => {
    // --- DADOS DOS AGENTES (CAM para adulto de 30-40 anos) ---
    const ANESTHETIC_AGENTS = {
        'Sevoflurano': { bloodGas: 0.65, mac: 2.0, maxVaporizer: 8 },
        'Desflurano': { bloodGas: 0.42, mac: 6.0, maxVaporizer: 18 },
        'Isoflurano': { bloodGas: 1.46, mac: 1.17, maxVaporizer: 5 },
        'Halotano': { bloodGas: 2.54, mac: 0.75, maxVaporizer: 5 }
    };

    // --- ELEMENTOS DA PÁGINA (DOM) ---
    const ageInput = document.getElementById('age');
    const ageUnitSelect = document.getElementById('age-unit');
    const weightInput = document.getElementById('weight');
    const agentSelector = document.getElementById('agent');
    const macBaseDisplay = document.getElementById('mac-base-display');
    const vaporizerSlider = document.getElementById('vaporizer');
    const vaporizerValueSpan = document.getElementById('vaporizer-value');
    const fgfSlider = document.getElementById('fgf');
    const fgfValueSpan = document.getElementById('fgf-value');
    const n2oSlider = document.getElementById('n2o');
    const n2oValueSpan = document.getElementById('n2o-value');
    const coSlider = document.getElementById('co');
    const coValueSpan = document.getElementById('co-value');
    const vaSlider = document.getElementById('va');
    const vaValueSpan = document.getElementById('va-value');
    const calculationDisplay = document.getElementById('calculation-display');
    const simTimeInput = document.getElementById('sim-time');
    const startStopBtn = document.getElementById('start-stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');
    const fiDisplay = document.getElementById('fi-display');
    const faDisplay = document.getElementById('fa-display');
    const macDisplay = document.getElementById('mac-display');
    const kpiTimeToMac = document.getElementById('kpi-time-to-mac');
    const kpiFaFinal = document.getElementById('kpi-fa-final');
    const kpiMacAge = document.getElementById('kpi-mac-age');

    // --- VARIÁVEIS DA SIMULAÇÃO ---
    let chart;
    let simulationInterval;
    let isRunning = false;
    let currentTime = 0;
    let fi = 0, fa = 0;
    let timeToMac = null;
    let ageAdjustedMac = 2.0;
    const TIME_STEP = 1;

    // --- FUNÇÕES ---

    function initialize() {
        Object.keys(ANESTHETIC_AGENTS).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            agentSelector.appendChild(option);
        });
        setupEventListeners();
        createChart();
        resetSimulation();
    }

    function getAgeInYears() {
        const age = parseFloat(ageInput.value) || 0;
        const unit = ageUnitSelect.value;
        if (unit === 'months') return age / 12;
        if (unit === 'days') return age / 365;
        return age;
    }

    function updateAllParameters() {
        const ageYears = getAgeInYears();
        const weight = parseFloat(weightInput.value);

        // 1. Ajustar CAM (Farmacodinâmica)
        const agent = ANESTHETIC_AGENTS[agentSelector.value];
        const baseMac = agent.mac;
        macBaseDisplay.textContent = `(CAM Base: ${baseMac}%)`;

        // Fórmula de LeDez para ajuste da CAM com a idade
        if (ageYears <= 1) {
            ageAdjustedMac = baseMac * 1.5; // Pico em lactentes
        } else {
            ageAdjustedMac = baseMac * (10 ** (-0.00269 * (ageYears - 40)));
        }
        kpiMacAge.textContent = `${ageAdjustedMac.toFixed(2)} %`;

        // 2. Ajustar Fisiologia (Farmacocinética)
        if (!weight || weight < 1) return;

        let coPerKg, vaPerKg;
        if (ageYears < 1) { // Lactentes
            coPerKg = 120; vaPerKg = 80;
        } else if (ageYears < 12) { // Crianças
            coPerKg = 100; vaPerKg = 70;
        } else { // Adultos
            coPerKg = 70; vaPerKg = 60;
        }

        const newCO = weight * coPerKg / 1000;
        const newVA = weight * vaPerKg / 1000;

        coSlider.value = newCO.toFixed(1);
        coValueSpan.textContent = newCO.toFixed(1);
        vaSlider.value = newVA.toFixed(1);
        vaValueSpan.textContent = newVA.toFixed(1);

        // 3. Atualizar display de fórmulas
        calculationDisplay.innerHTML = `
            <p>CAM (Idade): <code>${ageAdjustedMac.toFixed(2)}%</code></p>
            <p>DC: ${weight}kg * ${coPerKg}mL/kg/min = <code>${newCO.toFixed(1)} L/min</code></p>
            <p>VA: ${weight}kg * ${vaPerKg}mL/kg/min = <code>${newVA.toFixed(1)} L/min</code></p>
        `;
    }

    function setupEventListeners() {
        [ageInput, ageUnitSelect, weightInput, agentSelector].forEach(el => {
            el.addEventListener('input', updateAllParameters);
        });
        
        startStopBtn.addEventListener('click', toggleSimulation);
        resetBtn.addEventListener('click', resetSimulation);
        exportBtn.addEventListener('click', exportChart);
        
        // ... outros event listeners ...
        vaporizerSlider.addEventListener('input', () => vaporizerValueSpan.textContent = parseFloat(vaporizerSlider.value).toFixed(1));
        fgfSlider.addEventListener('input', () => fgfValueSpan.textContent = parseFloat(fgfSlider.value).toFixed(1));
        n2oSlider.addEventListener('input', () => n2oValueSpan.textContent = n2oSlider.value);
        coSlider.addEventListener('input', () => coValueSpan.textContent = parseFloat(coSlider.value).toFixed(1));
        vaSlider.addEventListener('input', () => vaValueSpan.textContent = parseFloat(vaSlider.value).toFixed(1));
    }

    function createChart() {
        const ctx = document.getElementById('anesthesia-chart').getContext('2d');
        chart = new Chart(ctx, { /* ... (código do gráfico inalterado) ... */ });
    }
    
    // ... O resto das funções (createChart, toggleSimulation, etc.) ...
    
    function createChart() {
        const ctx = document.getElementById('anesthesia-chart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Tempo (minutos)' }, type: 'linear', min: 0 },
                    y: { title: { display: true, text: 'Concentração (%)' }, beginAtZero: true }
                },
                animation: { duration: 0 },
                interaction: { mode: 'index', intersect: false },
                plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.formattedValue}%` } } }
            }
        });
    }

    function toggleSimulation() {
        isRunning = !isRunning;
        if (isRunning) {
            startStopBtn.textContent = 'Pausar';
            startStopBtn.classList.add('running');
            chart.options.scales.x.max = parseInt(simTimeInput.value);
            simulationInterval = setInterval(simulationStep, 100);
        } else {
            startStopBtn.textContent = 'Continuar';
            startStopBtn.classList.remove('running');
            clearInterval(simulationInterval);
            updateKpis();
        }
    }

    function resetSimulation() {
        if (isRunning) toggleSimulation();
        startStopBtn.textContent = 'Iniciar';
        
        currentTime = 0;
        fi = 0;
        fa = 0;
        timeToMac = null;
        
        ageInput.value = 30;
        ageUnitSelect.value = 'years';
        weightInput.value = 70;
        agentSelector.value = 'Sevoflurano';
        
        const agent = ANESTHETIC_AGENTS['Sevoflurano'];
        vaporizerSlider.value = agent.mac; // Valor base, não o ajustado
        fgfSlider.value = 2.0;
        n2oSlider.value = 0;
        
        updateAllParameters(); // Ajusta DC, VA, MAC e fórmulas
        vaporizerValueSpan.textContent = parseFloat(vaporizerSlider.value).toFixed(1);
        fgfValueSpan.textContent = parseFloat(fgfSlider.value).toFixed(1);
        n2oValueSpan.textContent = n2oSlider.value;
        
        chart.data = {
            datasets: [
                { label: 'Fração Inspirada (FI)', data: [{x: 0, y: 0}], borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 2, fill: false, stepped: true, pointRadius: 0 },
                { label: 'Fração Alveolar (FA)', data: [{x: 0, y: 0}], borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 3, fill: false, tension: 0.1, pointRadius: 0 }
            ]
        };
        chart.options.scales.x.max = parseInt(simTimeInput.value);
        chart.update();
        
        updateDisplays();
        updateKpis(true);
    }

    function simulationStep() {
        const totalDurationSeconds = parseInt(simTimeInput.value) * 60;
        if (currentTime >= totalDurationSeconds) {
            if (isRunning) toggleSimulation();
            return;
        }

        const agent = ANESTHETIC_AGENTS[agentSelector.value];
        const vaporizerSetting = parseFloat(vaporizerSlider.value) / 100;
        const fgf = parseFloat(fgfSlider.value);
        const n2oPercent = parseFloat(n2oSlider.value) / 100;
        const cardiacOutput = parseFloat(coSlider.value);
        const alveolarVentilation = parseFloat(vaSlider.value);

        const fgfFactor = Math.min(1, fgf / 5.0);
        const targetFi = vaporizerSetting * fgfFactor;
        fi += (targetFi - fi) * 0.1;

        const bloodGasCoefficient = agent.bloodGas;
        let timeConstant = (alveolarVentilation / cardiacOutput) / bloodGasCoefficient;
        
        if (n2oPercent > 0 && currentTime < 120) timeConstant *= 1.25;

        fa += (fi - fa) * timeConstant * (TIME_STEP / 60.0);
        
        const macRatio = fa * 100 / ageAdjustedMac;
        if (!timeToMac && Math.round(macRatio * 1000) >= 995) {
            timeToMac = currentTime / 60;
            kpiTimeToMac.textContent = `${timeToMac.toFixed(1)} min`; 
        }

        const timeInMinutes = currentTime / 60;
        chart.data.datasets[0].data.push({x: timeInMinutes, y: fi * 100});
        chart.data.datasets[1].data.push({x: timeInMinutes, y: fa * 100});
        
        chart.update('none');
        updateDisplays();
        currentTime += TIME_STEP;
    }

    function updateDisplays() {
        fiDisplay.textContent = (fi * 100).toFixed(2) + ' %';
        faDisplay.textContent = (fa * 100).toFixed(2) + ' %';
        macDisplay.textContent = ageAdjustedMac > 0 ? (fa * 100 / ageAdjustedMac).toFixed(2) : 'N/A';
    }
    
    function updateKpis(clear = false) {
        if (clear) {
            kpiTimeToMac.textContent = '-- min';
            kpiFaFinal.textContent = '-- %';
            kpiMacAge.textContent = '-- %'; // Limpa também no reset
            return;
        }
        kpiTimeToMac.textContent = timeToMac ? `${timeToMac.toFixed(1)} min` : 'N/A';
        kpiFaFinal.textContent = `${(fa * 100).toFixed(2)} %`;
    }
    
    function exportChart() {
        const link = document.createElement('a');
        link.href = chart.toBase64Image('image/png', 1);
        link.download = 'simulacao_anestesia_inalatoria.png';
        link.click();
    }
    
    initialize();
});