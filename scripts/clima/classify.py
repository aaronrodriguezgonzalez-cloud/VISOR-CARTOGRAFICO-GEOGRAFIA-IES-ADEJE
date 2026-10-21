# Clasificaciones vectorizadas (idénticas a las de la ficha de ANAMBRO en JavaScript)
import numpy as np
KORDER=['Af','Am','Aw','BWh','BWk','BSh','BSk','Csa','Csb','Csc','Cwa','Cwb','Cwc','Cfa','Cfb','Cfc','Dsa','Dsb','Dsc','Dsd','Dwa','Dwb','Dwc','Dwd','Dfa','Dfb','Dfc','Dfd','ET','EF']
MORDER=['A1','A2','A3','B1','B2','C1','C2','D1','D2','E','F1','F2','G']
def _halves(lat):
    north=np.array([0,0,0,1,1,1,1,1,1,0,0,0],bool)[:,None]
    return np.where(lat[None,:]>=0,north,~north)
def koppen(T,P,lat):
    """T,P: (12,N); lat: (N,). Devuelve índices en KORDER (-1 sin dato)."""
    S=_halves(lat)
    MAT=T.mean(0);MAP=P.sum(0);Tw=T.max(0);Tc=T.min(0)
    Ps=(P*S).sum(0);Pw=MAP-Ps
    big=1e9
    Psdry=np.where(S,P,big).min(0);Pswet=np.where(S,P,-big).max(0);Pwdry=np.where(~S,P,big).min(0);Pwwet=np.where(~S,P,-big).max(0)
    Pdry=P.min(0);Tmon10=(T>=10).sum(0)
    Pth=np.where((MAP>0)&(Pw>=0.7*MAP),2*MAT,np.where((MAP>0)&(Ps>=0.7*MAP),2*MAT+28,2*MAT+14))
    out=np.full(MAT.shape,-1,np.int16);code=np.empty(MAT.shape,object)
    idx={k:i for i,k in enumerate(KORDER)}
    E=Tw<10
    B=(~E)&(MAP<10*Pth)
    A=(~E)&(~B)&(Tc>=18)
    CD=(~E)&(~B)&(~A)
    res=np.full(MAT.shape,'',dtype='<U3')
    res[E]=np.where(Tw[E]>0,'ET','EF')
    bw=np.where(MAP<5*Pth,'BW','BS');bh=np.where(MAT>=18,'h','k')
    res[B]=np.char.add(bw[B],bh[B])
    aa=np.where(Pdry>=60,'Af',np.where(Pdry>=100-MAP/25,'Am','Aw'));res[A]=aa[A]
    G=np.where(Tc>0,'C','D')
    L2=np.where((Psdry<40)&(Psdry<Pwwet/3),'s',np.where(Pwdry<Pswet/10,'w','f'))
    L3=np.where(Tw>=22,'a',np.where(Tmon10>=4,'b',np.where((G=='D')&(Tc<-38),'d','c')))
    res[CD]=np.char.add(np.char.add(G[CD],L2[CD]),L3[CD])
    for k,i in idx.items(): out[res==k]=i
    return out
SUMMER_N=np.array([0,0,0,1,1,1,1,1,1,0,0,0],bool)
def miller(T,P,lat,z=None,dW=None,dE=None,detail=False):
    """Miller con base geográfica (ANAMBRO r53b). T,P (12,N); lat (N,); z altitud; dW,dE distancia (km) al océano
    abierto hacia el oeste y el este a lo largo del paralelo."""
    N=T.shape[1]
    if dW is None: dW=np.full(N,np.inf)
    if dE is None: dE=np.full(N,np.inf)
    S=_halves(lat)
    MAT=T.mean(0);MAP=P.sum(0);Tw=T.max(0);Tc=T.min(0);cold=(T<6).sum(0);amp=Tw-Tc
    aridS=((P<2*T)&S).sum(0); dry60=(P<60).sum(0)
    west=(dW<=600)&(np.abs(lat)>=25); east=(dE<=600)&(np.abs(lat)<=30)
    thermal=np.where(MAT>=21,'A',np.where(cold==0,'B',np.where(cold<=5,'C','D')))
    A=np.where((np.abs(lat)<=12)&(dry60<=2),'A1',np.where(east&(dry60<=5),'A2','A3'))
    B=np.where(aridS>=2,'B1',np.where(west&(np.abs(lat)>=35),'C1','B2'))
    Cc=np.where(west&(amp<18)&((aridS==0)|(MAP>=800)),'C1','C2')
    D=np.where(west&(amp<25),'D1','D2')
    sub=np.where(thermal=='A',A,np.where(thermal=='B',B,np.where(thermal=='C',Cc,D)))
    res=np.where(Tw<10,'E',np.where((MAP<250)&(cold<=5),np.where(cold==0,'F1','F2'),sub))
    if z is not None: res=np.where((np.asarray(z)>=1500)&(res!='E'),'G',res)
    out=np.full(MAT.shape,-1,np.int16)
    for i,k in enumerate(MORDER): out[res==k]=i
    return out
