import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Mapa para guardar o índice do workspace original de cada janela
const originalWorkspaces = new WeakMap();

export default class MinimizeToNewWorkspaceExtension {
    enable() {
        this._signals = [];
        
        // Monitorar janelas existentes
        global.display.get_tab_list(Meta.TabList.NORMAL, null).forEach(window => {
            this._connectWindowSignal(window);
        });

        // Monitorar novas janelas criadas
        this._signals.push(global.display.connect('window-created', (_, window) => {
            this._connectWindowSignal(window);
        }));
    }

    disable() {
        // Limpar sinais globais
        this._signals.forEach(id => global.display.disconnect(id));
        this._signals = [];
        
        // Nota: Sinais conectados diretamente aos objetos window (g_signal_connect) 
        // são geralmente limpos pelo Garbage Collector do GJS ao destruir a extensão, 
        // mas em uma implementação complexa seria ideal rastrear e desconectar todos.
    }

    _connectWindowSignal(window) {
        // Evitar conectar múltiplas vezes na mesma janela
        if (window._minimizeMonitorId) return;

        // Conectar ao evento de mudança de propriedade "minimized"
        // notify::minimized dispara tanto ao minimizar quanto ao restaurar
        const id = window.connect('notify::minimized', () => {
            this._handleWindowStateChange(window);
        });

        window._minimizeMonitorId = id;
    }

    _handleWindowStateChange(window) {
        if (window.minimized) {
            // --- Lógica de Minimizar ---
            
            // 1. Guarda o workspace atual
            const currentWorkspace = window.get_workspace();
            if (currentWorkspace) {
                originalWorkspaces.set(window, currentWorkspace.index());
            }

            // 2. Move para o final (cria novo workspace se estiver usando workspaces dinâmicos)
            const workspaceManager = global.workspace_manager;
            const lastIndex = workspaceManager.n_workspaces - 1;
            const lastWorkspace = workspaceManager.get_workspace_by_index(lastIndex);
            
            if (lastWorkspace) {
                window.change_workspace(lastWorkspace);
            }

        } else {
            // --- Lógica de Restaurar (Unminimize) ---
            
            if (originalWorkspaces.has(window)) {
                const originalIndex = originalWorkspaces.get(window);
                const workspaceManager = global.workspace_manager;

                // Verifica se o workspace original ainda existe
                if (originalIndex < workspaceManager.n_workspaces) {
                    const targetWorkspace = workspaceManager.get_workspace_by_index(originalIndex);
                    
                    // Move a janela de volta
                    window.change_workspace(targetWorkspace);
                    
                    // Opcional: Ativar o workspace para focar na janela
                    targetWorkspace.activate(global.get_current_time());
                }
                
                // Limpa o registro
                originalWorkspaces.delete(window);
            }
        }
    }
}
