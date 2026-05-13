// 관리자 전용 로직: 수량 초기화 + 오차범위 설정

document.addEventListener('DOMContentLoaded', () => {
  loadTolerance();

  document.getElementById('saveToleranceBtn').addEventListener('click', saveTolerance);
  document.getElementById('resetQuantityBtn').addEventListener('click', resetQuantities);
});

async function loadTolerance() {
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', 'tolerance')
      .single();

    if (!error && data) {
      document.getElementById('toleranceInput').value = data.value;
      updateCurrentToleranceLabel(parseInt(data.value) || 0);
    }
  } catch (e) {
    console.error('오차범위 로드 실패:', e);
  }
}

async function saveTolerance() {
  const input = document.getElementById('toleranceInput');
  const raw = input.value.trim();
  const value = parseFloat(raw);

  if (raw === '' || isNaN(value) || value < 0 || value > 100) {
    showAdminNotification('0~100 사이의 숫자를 입력해주세요.', 'error');
    return;
  }

  const btn = document.getElementById('saveToleranceBtn');
  btn.disabled = true;

  try {
    const { error } = await supabaseClient
      .from('settings')
      .upsert({ key: 'tolerance', value: String(value), updated_at: new Date().toISOString() });

    if (error) throw error;

    updateCurrentToleranceLabel(value);
    showAdminNotification(`오차범위 ±${value}%로 저장되었습니다.`, 'success');
  } catch (e) {
    showAdminNotification('저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function resetQuantities() {
  if (!confirm('모든 제품의 수량을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

  const btn = document.getElementById('resetQuantityBtn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span><span>초기화 중...</span>';

  try {
    const { error } = await supabaseClient
      .from('products')
      .update({ quantity: null })
      .gte('id', 0);

    if (error) throw error;

    showAdminNotification('모든 제품의 수량이 초기화되었습니다.', 'success');

    if (typeof loadPreview === 'function') loadPreview();
    if (typeof loadStatistics === 'function') loadStatistics();
  } catch (e) {
    showAdminNotification('초기화 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🔄</span><span>수량 전체 초기화</span>';
  }
}

function updateCurrentToleranceLabel(value) {
  const label = document.getElementById('currentTolerance');
  if (label) label.textContent = `현재 적용 중: ±${value}%`;
}

function showAdminNotification(message, type = 'info') {
  const el = document.getElementById('adminNotification');
  if (!el) return;
  el.className = `alert alert-${type} mt-2`;
  el.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}
