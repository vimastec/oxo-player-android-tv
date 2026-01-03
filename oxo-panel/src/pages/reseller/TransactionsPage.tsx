import { useEffect, useState } from 'react';
import { Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  mac_address: string;
  created_at: string;
}

export function ResellerTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await resellerApi.getTransactions();
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold mb-6">Historique</h1>

      <div className="card overflow-hidden">
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Description</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {tx.type === 'credit_add' ? (
                          <ArrowUpCircle className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5 text-warning" />
                        )}
                        <span>
                          {tx.type === 'credit_add' ? 'Crédits reçus' : 'Activation'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`font-bold ${
                          tx.type === 'credit_add' ? 'text-success' : 'text-warning'
                        }`}
                      >
                        {tx.type === 'credit_add' ? '+' : '-'}{tx.amount}
                      </span>
                    </td>
                    <td>
                      {tx.description}
                      {tx.mac_address && (
                        <span className="text-xs text-muted block font-mono">
                          {tx.mac_address}
                        </span>
                      )}
                    </td>
                    <td>{new Date(tx.created_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-center py-12">Aucune transaction</p>
        )}
      </div>
    </div>
  );
}























